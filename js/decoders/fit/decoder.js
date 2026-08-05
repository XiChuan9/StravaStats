import { validateImportedActivityBundle } from '../../data/contracts/index.js';
import {
    IMPORT_ERROR_CODE,
    ImportError,
    importError
} from '../../import/errors.js';
import { deepFreeze, ownDataValues } from '../../import/safe-data.js';

export const FIT_MEDIA_TYPE = 'application/vnd.ant.fit;base64';

export const FIT_LIMITS = deepFreeze({
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

const INPUT_FIELDS = Object.freeze(['mediaType', 'content']);
const FIT_EPOCH_UNIX_SECONDS = 631_065_600;
const BASE64_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const SUPPORTED_GLOBAL_MESSAGES = new Set([0, 18, 19, 20, 21, 23, 132]);

const BASE_TYPES = Object.freeze({
    0x00: Object.freeze({ id: 0, size: 1, kind: 'uint', invalid: 0xff }),
    0x01: Object.freeze({ id: 1, size: 1, kind: 'sint', invalid: 0x7f }),
    0x02: Object.freeze({ id: 2, size: 1, kind: 'uint', invalid: 0xff }),
    0x83: Object.freeze({ id: 3, size: 2, kind: 'sint', invalid: 0x7fff }),
    0x84: Object.freeze({ id: 4, size: 2, kind: 'uint', invalid: 0xffff }),
    0x85: Object.freeze({ id: 5, size: 4, kind: 'sint', invalid: 0x7fffffff }),
    0x86: Object.freeze({ id: 6, size: 4, kind: 'uint', invalid: 0xffffffff }),
    0x07: Object.freeze({ id: 7, size: 1, kind: 'string', invalid: 0 }),
    0x88: Object.freeze({ id: 8, size: 4, kind: 'float', invalid: null }),
    0x89: Object.freeze({ id: 9, size: 8, kind: 'float', invalid: null }),
    0x0a: Object.freeze({ id: 10, size: 1, kind: 'uint', invalid: 0 }),
    0x8b: Object.freeze({ id: 11, size: 2, kind: 'uint', invalid: 0 }),
    0x8c: Object.freeze({ id: 12, size: 4, kind: 'uint', invalid: 0 }),
    0x0d: Object.freeze({ id: 13, size: 1, kind: 'byte', invalid: 0xff }),
    0x8e: Object.freeze({ id: 14, size: 8, kind: 'sint64', invalid: null }),
    0x8f: Object.freeze({ id: 15, size: 8, kind: 'uint64', invalid: null }),
    0x90: Object.freeze({ id: 16, size: 8, kind: 'uint64z', invalid: 0n })
});

function field(name, baseTypeId, { array = false, scale = 1 } = {}) {
    return Object.freeze({ name, baseTypeId, array, scale });
}

const MESSAGE_FIELDS = Object.freeze({
    0: Object.freeze({
        0: field('type', 0),
        1: field('manufacturer', 4),
        2: field('product', 4),
        4: field('timeCreated', 6),
        5: field('number', 4)
    }),
    18: Object.freeze({
        253: field('timestamp', 6),
        2: field('startTime', 6),
        5: field('sport', 0),
        6: field('subSport', 0),
        7: field('totalElapsedTime', 6, { scale: 1000 }),
        8: field('totalTimerTime', 6, { scale: 1000 }),
        9: field('totalDistance', 6, { scale: 100 }),
        16: field('averageHeartRate', 2),
        18: field('averageCadence', 2),
        20: field('averagePower', 4),
        22: field('totalAscent', 4),
        44: field('poolLength', 4, { scale: 100 })
    }),
    19: Object.freeze({
        253: field('timestamp', 6),
        2: field('startTime', 6),
        7: field('totalElapsedTime', 6, { scale: 1000 }),
        8: field('totalTimerTime', 6, { scale: 1000 }),
        9: field('totalDistance', 6, { scale: 100 })
    }),
    20: Object.freeze({
        253: field('timestamp', 6),
        0: field('positionLatitude', 5),
        1: field('positionLongitude', 5),
        3: field('heartRate', 2),
        4: field('cadence', 2),
        5: field('distance', 6, { scale: 100 }),
        6: field('speed', 4, { scale: 1000 }),
        7: field('power', 4),
        73: field('enhancedSpeed', 6, { scale: 1000 })
    }),
    21: Object.freeze({
        253: field('timestamp', 6),
        0: field('event', 0),
        1: field('eventType', 0)
    }),
    23: Object.freeze({
        253: field('timestamp', 6),
        0: field('deviceIndex', 2),
        2: field('manufacturer', 4),
        27: field('productName', 7)
    }),
    132: Object.freeze({
        253: field('timestamp', 6),
        0: field('fractionalTimestamp', 4, { scale: 32768 }),
        1: field('time256', 2, { scale: 256 }),
        6: field('filteredBpm', 2, { array: true }),
        9: field('eventTimestamp', 6, { array: true, scale: 1024 }),
        10: field('eventTimestamp12', 13, { array: true })
    })
});

const WARNING_DEFINITIONS = deepFreeze({
    FIT_HEADER_CRC_MISMATCH: {
        path: '/fit/header',
        message: 'The FIT header checksum does not match.'
    },
    FIT_FILE_CRC_MISMATCH: {
        path: '/fit/file',
        message: 'The FIT file checksum does not match.'
    },
    FIT_TIMEZONE_UNAVAILABLE: {
        path: '/activity/timeZone',
        message: 'The supported FIT messages do not provide a trustworthy time zone.'
    },
    FIT_IMPORT_TIME_FALLBACK: {
        path: '/sources/0/importedAt',
        message: 'The FIT activity start time is used as the deterministic import time.'
    },
    FIT_DEVELOPER_FIELDS_IGNORED: {
        path: '/fit/developerFields',
        message: 'FIT developer fields were ignored.'
    },
    FIT_UNKNOWN_MESSAGE_IGNORED: {
        path: '/fit/messages',
        message: 'An unsupported FIT message was ignored.'
    },
    FIT_UNKNOWN_FIELD_IGNORED: {
        path: '/fit/fields',
        message: 'An unsupported FIT native field was ignored.'
    },
    FIT_SPORT_UNMAPPED: {
        path: '/activity/sportCategory',
        message: 'The FIT sport metadata could not be mapped.'
    },
    FIT_DEVICE_MANUFACTURER_UNMAPPED: {
        path: '/devices',
        message: 'A FIT device manufacturer could not be mapped.'
    },
    FIT_EVENT_UNMAPPED: {
        path: '/events',
        message: 'A FIT event could not be mapped.'
    }
});

function fail(code = IMPORT_ERROR_CODE.FILE_CORRUPTED) {
    throw importError(code, false, 'decode');
}

function addWarning(warnings, code) {
    const definition = WARNING_DEFINITIONS[code];
    if (!definition) fail();
    warnings.set(code, Object.freeze({ code, ...definition }));
}

function sortedWarnings(warnings) {
    return [...warnings.values()].sort((left, right) =>
        compareText(left.code, right.code)
        || compareText(left.path, right.path)
        || compareText(left.message, right.message)
    );
}

function compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function decodeBase64(content) {
    if (typeof content !== 'string' || content.length === 0) {
        fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    }
    if (
        content.length % 4 !== 0
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)
    ) fail();

    const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0;
    const byteLength = content.length / 4 * 3 - padding;
    if (byteLength === 0) fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    if (byteLength > FIT_LIMITS.maxDecodedBytes) fail();

    const bytes = new Uint8Array(byteLength);
    let outputOffset = 0;
    for (let offset = 0; offset < content.length; offset += 4) {
        const a = BASE64_ALPHABET.indexOf(content[offset]);
        const b = BASE64_ALPHABET.indexOf(content[offset + 1]);
        const c = content[offset + 2] === '='
            ? 0
            : BASE64_ALPHABET.indexOf(content[offset + 2]);
        const d = content[offset + 3] === '='
            ? 0
            : BASE64_ALPHABET.indexOf(content[offset + 3]);
        if (a < 0 || b < 0 || c < 0 || d < 0) fail();
        if (content[offset + 2] === '=' && (b & 0x0f) !== 0) fail();
        if (content[offset + 3] === '=' && content[offset + 2] !== '=' && (c & 0x03) !== 0) fail();
        const combined = a << 18 | b << 12 | c << 6 | d;
        if (outputOffset < byteLength) bytes[outputOffset++] = combined >>> 16;
        if (outputOffset < byteLength) bytes[outputOffset++] = combined >>> 8 & 0xff;
        if (outputOffset < byteLength) bytes[outputOffset++] = combined & 0xff;
    }
    return bytes;
}

function calculateCrc(bytes, start, end) {
    let crc = 0;
    for (let index = start; index < end; index += 1) {
        let value = bytes[index];
        for (let bit = 0; bit < 8; bit += 1) {
            const mix = (crc ^ value) & 1;
            crc >>>= 1;
            if (mix) crc ^= 0xa001;
            value >>>= 1;
        }
    }
    return crc;
}

function readUint16(bytes, offset, littleEndian = true) {
    return littleEndian
        ? bytes[offset] | bytes[offset + 1] << 8
        : bytes[offset] << 8 | bytes[offset + 1];
}

function readUint32(bytes, offset, littleEndian = true) {
    return littleEndian
        ? (bytes[offset]
            + bytes[offset + 1] * 0x100
            + bytes[offset + 2] * 0x1_0000
            + bytes[offset + 3] * 0x100_0000) >>> 0
        : (bytes[offset] * 0x100_0000
            + bytes[offset + 1] * 0x1_0000
            + bytes[offset + 2] * 0x100
            + bytes[offset + 3]) >>> 0;
}

function readSigned(value, bits) {
    const sign = 2 ** (bits - 1);
    return value >= sign ? value - 2 ** bits : value;
}

function readBigInt(bytes, offset, littleEndian, signed) {
    let value = 0n;
    for (let index = 0; index < 8; index += 1) {
        const source = littleEndian ? offset + 7 - index : offset + index;
        value = value << 8n | BigInt(bytes[source]);
    }
    if (signed && (value & 0x8000_0000_0000_0000n)) {
        value -= 0x1_0000_0000_0000_0000n;
    }
    return value;
}

function decodeString(bytes, offset, size) {
    let end = offset;
    while (end < offset + size && bytes[end] !== 0) end += 1;
    for (let index = end; index < offset + size; index += 1) {
        if (bytes[index] !== 0) fail();
    }
    if (end === offset) return null;
    try {
        const value = new TextDecoder('utf-8', { fatal: true })
            .decode(bytes.subarray(offset, end));
        if (value.length === 0 || /[\u0000-\u001f\u007f]/.test(value)) fail();
        return value;
    } catch {
        fail();
    }
}

function decodeScalar(bytes, offset, baseType, littleEndian) {
    if (baseType.kind === 'string') fail();
    if (baseType.kind === 'byte') return bytes[offset];
    let value;
    if (baseType.kind === 'float' && baseType.size === 8) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
        value = view.getFloat64(0, littleEndian);
    } else if (baseType.kind === 'float' && baseType.size === 4) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
        value = view.getFloat32(0, littleEndian);
    } else if (baseType.size === 1) value = bytes[offset];
    else if (baseType.size === 2) value = readUint16(bytes, offset, littleEndian);
    else if (baseType.size === 4) value = readUint32(bytes, offset, littleEndian);
    else if (baseType.size === 8) {
        value = readBigInt(bytes, offset, littleEndian, baseType.kind === 'sint64');
    } else fail();

    if (baseType.kind === 'sint' && baseType.size > 1) {
        value = readSigned(value, baseType.size * 8);
    } else if (baseType.kind === 'sint' && baseType.size === 1) {
        value = readSigned(value, 8);
    }
    if (baseType.invalid !== null && value === baseType.invalid) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    if (typeof value === 'bigint') {
        if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
            fail();
        }
        return Number(value);
    }
    return value;
}

function decodeKnownField(bytes, offset, definition, profileField, littleEndian) {
    const baseType = BASE_TYPES[definition.baseTypeByte];
    if (!baseType || baseType.id !== profileField.baseTypeId) fail();
    if (baseType.kind === 'string') {
        return decodeString(bytes, offset, definition.size);
    }
    if (definition.size % baseType.size !== 0) fail();
    const count = definition.size / baseType.size;
    if (!profileField.array && count !== 1) fail();
    const values = [];
    for (let index = 0; index < count; index += 1) {
        values.push(decodeScalar(
            bytes,
            offset + index * baseType.size,
            baseType,
            littleEndian
        ));
    }
    const scaled = values.map(value =>
        value === null ? null : value / profileField.scale
    );
    return profileField.array ? scaled : scaled[0];
}

function parseDefinition(bytes, state, recordHeader) {
    state.definitionCount += 1;
    if (state.definitionCount > FIT_LIMITS.maxDefinitions) fail();
    const localMessage = recordHeader & 0x0f;
    if ((recordHeader & 0x10) !== 0) fail();
    const hasDeveloperFields = (recordHeader & 0x20) !== 0;
    if (state.offset + 5 > state.dataEnd) fail();
    const reserved = bytes[state.offset++];
    const architecture = bytes[state.offset++];
    if (reserved !== 0 || (architecture !== 0 && architecture !== 1)) fail();
    const littleEndian = architecture === 0;
    const globalMessage = readUint16(bytes, state.offset, littleEndian);
    state.offset += 2;
    const fieldCount = bytes[state.offset++];
    if (fieldCount > FIT_LIMITS.maxNativeFields) fail();
    if (state.offset + fieldCount * 3 > state.dataEnd) fail();
    const fields = [];
    const fieldNumbers = new Set();
    let messageBytes = 0;
    for (let index = 0; index < fieldCount; index += 1) {
        const number = bytes[state.offset++];
        const size = bytes[state.offset++];
        const baseTypeByte = bytes[state.offset++];
        const baseType = BASE_TYPES[baseTypeByte];
        if (!baseType || size === 0 || size % baseType.size !== 0 || fieldNumbers.has(number)) {
            fail();
        }
        fieldNumbers.add(number);
        messageBytes += size;
        if (messageBytes > FIT_LIMITS.maxMessageBytes) fail();
        fields.push(Object.freeze({ number, size, baseTypeByte }));
    }

    const developerFields = [];
    if (hasDeveloperFields) {
        if (state.offset >= state.dataEnd) fail();
        const developerCount = bytes[state.offset++];
        if (developerCount > FIT_LIMITS.maxDeveloperFields) fail();
        if (state.offset + developerCount * 3 > state.dataEnd) fail();
        const developerKeys = new Set();
        for (let index = 0; index < developerCount; index += 1) {
            const number = bytes[state.offset++];
            const size = bytes[state.offset++];
            const developerIndex = bytes[state.offset++];
            const key = `${developerIndex}:${number}`;
            if (size === 0 || developerKeys.has(key)) fail();
            developerKeys.add(key);
            messageBytes += size;
            if (messageBytes > FIT_LIMITS.maxMessageBytes) fail();
            developerFields.push(Object.freeze({ number, size, developerIndex }));
        }
        if (developerFields.length > 0) {
            addWarning(state.warnings, 'FIT_DEVELOPER_FIELDS_IGNORED');
        }
    }

    state.definitions[localMessage] = Object.freeze({
        globalMessage,
        littleEndian,
        fields: Object.freeze(fields),
        developerFields: Object.freeze(developerFields),
        messageBytes
    });
}

function parseDataMessage(bytes, state, definition, compressedTimestamp = null) {
    state.dataRecordCount += 1;
    if (state.dataRecordCount > FIT_LIMITS.maxDataRecords) fail();
    const timestampField = definition.fields.find(item => item.number === 253);
    if (compressedTimestamp !== null) {
        if (
            !timestampField
            || timestampField.size !== 4
            || BASE_TYPES[timestampField.baseTypeByte]?.id !== 6
        ) fail();
    }
    const nativeBytes = definition.fields.reduce((total, item) =>
        total + (compressedTimestamp !== null && item.number === 253 ? 0 : item.size), 0
    );
    const developerBytes = definition.developerFields.reduce((total, item) =>
        total + item.size, 0
    );
    if (state.offset + nativeBytes + developerBytes > state.dataEnd) fail();

    const message = Object.create(null);
    const profile = MESSAGE_FIELDS[definition.globalMessage] ?? null;
    let fieldOffset = state.offset;
    for (const nativeField of definition.fields) {
        if (compressedTimestamp !== null && nativeField.number === 253) {
            message.timestamp = compressedTimestamp;
            continue;
        }
        const profileField = profile?.[nativeField.number]
            ?? (!profile && nativeField.number === 253
                ? MESSAGE_FIELDS[20][253]
                : null);
        if (profileField) {
            message[profileField.name] = decodeKnownField(
                bytes,
                fieldOffset,
                nativeField,
                profileField,
                definition.littleEndian
            );
        } else if (profile) {
            addWarning(state.warnings, 'FIT_UNKNOWN_FIELD_IGNORED');
        }
        fieldOffset += nativeField.size;
    }
    fieldOffset += developerBytes;
    state.offset = fieldOffset;

    if (message.timestamp !== undefined && message.timestamp !== null) {
        state.previousTimestamp = message.timestamp;
    }
    if (!SUPPORTED_GLOBAL_MESSAGES.has(definition.globalMessage)) {
        addWarning(state.warnings, 'FIT_UNKNOWN_MESSAGE_IGNORED');
        return;
    }
    message.encounter = state.encounter++;
    if (definition.globalMessage === 0) state.fileIds.push(message);
    else if (definition.globalMessage === 18) state.sessions.push(message);
    else if (definition.globalMessage === 19) state.laps.push(message);
    else if (definition.globalMessage === 20) state.records.push(message);
    else if (definition.globalMessage === 21) state.events.push(message);
    else if (definition.globalMessage === 23) state.devices.push(message);
    else if (definition.globalMessage === 132) state.hrMessages.push(message);
}

function parseFit(bytes) {
    const warnings = new Map();
    if (bytes.length < 14) fail();
    const headerSize = bytes[0];
    if (headerSize !== 12 && headerSize !== 14) fail();
    const protocolMajor = bytes[1] >>> 4;
    if (protocolMajor !== 1 && protocolMajor !== 2) fail();
    if (
        bytes[8] !== 0x2e
        || bytes[9] !== 0x46
        || bytes[10] !== 0x49
        || bytes[11] !== 0x54
    ) fail();
    const dataSize = readUint32(bytes, 4, true);
    const dataEnd = headerSize + dataSize;
    const expectedLength = dataEnd + 2;
    if (!Number.isSafeInteger(expectedLength) || expectedLength !== bytes.length || dataSize === 0) {
        fail();
    }
    if (headerSize === 14) {
        const expectedHeaderCrc = readUint16(bytes, 12, true);
        if (expectedHeaderCrc !== 0 && calculateCrc(bytes, 0, 12) !== expectedHeaderCrc) {
            addWarning(warnings, 'FIT_HEADER_CRC_MISMATCH');
        }
    }
    const expectedFileCrc = readUint16(bytes, dataEnd, true);
    if (calculateCrc(bytes, 0, dataEnd) !== expectedFileCrc) {
        addWarning(warnings, 'FIT_FILE_CRC_MISMATCH');
    }

    const state = {
        offset: headerSize,
        dataEnd,
        definitions: new Array(16).fill(null),
        definitionCount: 0,
        dataRecordCount: 0,
        encounter: 0,
        previousTimestamp: null,
        warnings,
        fileIds: [],
        sessions: [],
        laps: [],
        events: [],
        records: [],
        devices: [],
        hrMessages: []
    };

    while (state.offset < state.dataEnd) {
        const recordHeader = bytes[state.offset++];
        if ((recordHeader & 0x80) !== 0) {
            const localMessage = recordHeader >>> 5 & 0x03;
            const definition = state.definitions[localMessage];
            if (!definition || state.previousTimestamp === null) fail();
            const timeOffset = recordHeader & 0x1f;
            let timestamp = Math.floor(state.previousTimestamp / 0x20) * 0x20
                + timeOffset;
            if (timestamp < state.previousTimestamp) timestamp += 0x20;
            if (timestamp > 0xffff_fffe) fail();
            parseDataMessage(bytes, state, definition, timestamp);
        } else if ((recordHeader & 0x40) !== 0) {
            parseDefinition(bytes, state, recordHeader);
        } else {
            if ((recordHeader & 0x30) !== 0) fail();
            const definition = state.definitions[recordHeader & 0x0f];
            if (!definition) fail();
            parseDataMessage(bytes, state, definition);
        }
    }
    if (state.offset !== state.dataEnd) fail();
    return state;
}

function has(message, fieldName) {
    return Object.hasOwn(message, fieldName);
}

function requireNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail();
    return value;
}

function fitTimestampToIso(timestamp) {
    const value = requireNumber(timestamp);
    if (!Number.isInteger(value) || value < 0) fail();
    const milliseconds = (value + FIT_EPOCH_UNIX_SECONDS) * 1000;
    const date = new Date(milliseconds);
    if (!Number.isFinite(date.getTime())) fail();
    return date.toISOString();
}

function activityOffset(timestamp, sessionStart) {
    const value = requireNumber(timestamp) - sessionStart;
    if (!Number.isFinite(value) || value < 0) fail();
    return value;
}

function safeIdentityPart(value) {
    if (value === undefined || value === null) return 'x';
    if (!Number.isSafeInteger(value) || value < 0) fail();
    return String(value);
}

function mapSport(session, warnings) {
    const sport = session.sport;
    const subSport = session.subSport;
    if (sport === 1) {
        const variant = subSport === 1 || subSport === 45
            ? 'indoor'
            : subSport === 3
                ? 'trail'
                : null;
        return { category: 'run', variant };
    }
    if (sport === 2) {
        const variants = new Map([
            [6, 'indoor'],
            [7, 'road'],
            [8, 'mountain'],
            [46, 'gravel'],
            [58, 'virtual']
        ]);
        return { category: 'ride', variant: variants.get(subSport) ?? null };
    }
    if (sport === 5) {
        const variant = subSport === 17
            ? 'pool'
            : subSport === 18
                ? 'open-water'
                : null;
        return { category: 'swim', variant };
    }
    addWarning(warnings, 'FIT_SPORT_UNMAPPED');
    return { category: 'other', variant: null };
}

function mapManufacturer(value, warnings) {
    const names = new Map([
        [1, 'Garmin'],
        [32, 'Wahoo'],
        [129, 'COROS'],
        [294, 'COROS'],
        [144, 'Zwift'],
        [260, 'Zwift']
    ]);
    if (value === undefined || value === null) return null;
    const name = names.get(value) ?? null;
    if (!name) addWarning(warnings, 'FIT_DEVICE_MANUFACTURER_UNMAPPED');
    return name;
}

function setOptional(target, targetField, source, sourceField) {
    if (has(source, sourceField)) target[targetField] = source[sourceField];
}

function foldRecord(target, source) {
    const fields = [
        'positionLatitude',
        'positionLongitude',
        'heartRate',
        'cadence',
        'distance',
        'speed',
        'enhancedSpeed',
        'power'
    ];
    for (const fieldName of fields) {
        if (!has(source, fieldName)) continue;
        const incoming = source[fieldName];
        if (!has(target, fieldName) || target[fieldName] === null) {
            target[fieldName] = incoming;
        } else if (incoming !== null && target[fieldName] !== incoming) {
            fail();
        }
    }
}

function buildRecordRows(records, sessionStart) {
    const ordered = [...records].sort((left, right) =>
        requireNumber(left.timestamp) - requireNumber(right.timestamp)
        || left.encounter - right.encounter
    );
    const rows = [];
    for (const record of ordered) {
        if (!has(record, 'timestamp') || record.timestamp === null) fail();
        const offset = activityOffset(record.timestamp, sessionStart);
        const previous = rows.at(-1);
        if (previous && previous.offset === offset) foldRecord(previous, record);
        else {
            if (rows.length >= FIT_LIMITS.maxRecordPoints) fail();
            const row = { offset, encounter: record.encounter };
            foldRecord(row, record);
            rows.push(row);
        }
    }
    return rows;
}

function unpackEventTimestamp12(bytes, previousRaw) {
    if (!Array.isArray(bytes) || bytes.length === 0 || bytes.length % 3 !== 0) fail();
    if (bytes.length / 3 * 2 > 10) fail();
    const result = [];
    let accumulated = previousRaw;
    for (let index = 0; index < bytes.length; index += 3) {
        const values = [
            bytes[index] | (bytes[index + 1] & 0x0f) << 8,
            bytes[index + 1] >>> 4 | bytes[index + 2] << 4
        ];
        for (const value of values) {
            if (value === null) fail();
            if (accumulated === null) accumulated = value;
            else {
                let candidate = Math.floor(accumulated / 0x1000) * 0x1000
                    + value;
                if (candidate < accumulated) candidate += 0x1000;
                if (candidate > 0xffff_fffe) fail();
                accumulated = candidate;
            }
            result.push(accumulated);
        }
    }
    return { values: result, previousRaw: accumulated };
}

function expandHeartRateMessages(messages, sessionStart) {
    const points = new Map();
    let anchorTimestamp = null;
    let anchorEventTimestamp = null;
    let previousEventRaw = null;
    const ordered = [...messages].sort((left, right) => left.encounter - right.encounter);
    for (const message of ordered) {
        const filtered = message.filteredBpm;
        if (!Array.isArray(filtered) || filtered.length === 0) fail();
        let eventTimestamps = message.eventTimestamp;
        if (has(message, 'eventTimestamp12')) {
            if (has(message, 'eventTimestamp')) fail();
            const unpacked = unpackEventTimestamp12(
                message.eventTimestamp12,
                previousEventRaw
            );
            previousEventRaw = unpacked.previousRaw;
            eventTimestamps = unpacked.values.map(value => value / 1024);
        } else if (Array.isArray(eventTimestamps) && eventTimestamps.length > 0) {
            for (const value of eventTimestamps) {
                if (value === null) fail();
                previousEventRaw = Math.round(value * 1024);
            }
        }
        if (!Array.isArray(eventTimestamps) || eventTimestamps.length !== filtered.length) fail();

        if (has(message, 'timestamp') && message.timestamp !== null) {
            const fraction = has(message, 'fractionalTimestamp')
                && message.fractionalTimestamp !== null
                ? message.fractionalTimestamp
                : has(message, 'time256') && message.time256 !== null
                    ? message.time256
                    : 0;
            if (eventTimestamps.length !== 1) fail();
            anchorTimestamp = requireNumber(message.timestamp) + requireNumber(fraction);
            anchorEventTimestamp = requireNumber(eventTimestamps[0]);
        }
        if (anchorTimestamp === null || anchorEventTimestamp === null) fail();
        for (let index = 0; index < filtered.length; index += 1) {
            const heartRate = filtered[index];
            const eventTimestamp = eventTimestamps[index];
            if (
                typeof heartRate !== 'number'
                || !Number.isFinite(heartRate)
                || heartRate <= 0
                || heartRate > 300
                || typeof eventTimestamp !== 'number'
                || !Number.isFinite(eventTimestamp)
            ) fail();
            let normalizedEventTimestamp = eventTimestamp;
            if (normalizedEventTimestamp < anchorEventTimestamp) {
                if (anchorEventTimestamp - normalizedEventTimestamp > 0x40_0000) {
                    normalizedEventTimestamp += 0x40_0000;
                } else fail();
            }
            const timestamp = anchorTimestamp
                + normalizedEventTimestamp
                - anchorEventTimestamp;
            const offset = activityOffset(timestamp, sessionStart);
            const previous = points.get(offset);
            if (previous) {
                if (previous.value !== heartRate) fail();
            } else {
                if (points.size >= FIT_LIMITS.maxHeartRatePoints) fail();
                points.set(offset, {
                    offset,
                    value: heartRate,
                    encounter: message.encounter + index / 100
                });
            }
        }
    }
    return [...points.values()];
}

function buildStreams(activityId, recordRows, hrMessages, sessionStart) {
    const series = [];
    const addRecordSeries = (streamType, unit, selector) => {
        const values = recordRows.map(selector);
        if (!values.some(value => value !== null)) return;
        series.push({
            streamType,
            unit,
            offsetsSeconds: recordRows.map(row => row.offset),
            values
        });
    };
    addRecordSeries('position', 'wgs84', row => {
        if (
            typeof row.positionLatitude !== 'number'
            || typeof row.positionLongitude !== 'number'
        ) return null;
        return [
            row.positionLatitude * 180 / 2 ** 31,
            row.positionLongitude * 180 / 2 ** 31
        ];
    });
    addRecordSeries('distance', 'm', row =>
        typeof row.distance === 'number' ? row.distance : null
    );
    addRecordSeries('speed', 'm/s', row => {
        if (typeof row.enhancedSpeed === 'number') return row.enhancedSpeed;
        return typeof row.speed === 'number' ? row.speed : null;
    });

    const heartRatePoints = recordRows
        .filter(row => has(row, 'heartRate'))
        .map(row => ({
            offset: row.offset,
            value: typeof row.heartRate === 'number' ? row.heartRate : null,
            encounter: row.encounter
        }));
    heartRatePoints.push(...expandHeartRateMessages(hrMessages, sessionStart));
    heartRatePoints.sort((left, right) =>
        left.offset - right.offset || left.encounter - right.encounter
    );
    const foldedHeartRate = [];
    for (const point of heartRatePoints) {
        const previous = foldedHeartRate.at(-1);
        if (previous && previous.offset === point.offset) {
            if (previous.value === null) previous.value = point.value;
            else if (point.value !== null && previous.value !== point.value) fail();
        } else {
            if (foldedHeartRate.length >= FIT_LIMITS.maxHeartRatePoints) fail();
            foldedHeartRate.push(point);
        }
    }
    if (foldedHeartRate.some(point => point.value !== null)) {
        series.push({
            streamType: 'heartRate',
            unit: 'bpm',
            offsetsSeconds: foldedHeartRate.map(point => point.offset),
            values: foldedHeartRate.map(point => point.value)
        });
    }
    addRecordSeries('power', 'W', row =>
        typeof row.power === 'number' ? row.power : null
    );
    addRecordSeries('cadence', 'rpm', row =>
        typeof row.cadence === 'number' ? row.cadence : null
    );
    return { activityId, series };
}

function buildLaps(messages, activityId, sessionStart) {
    if (messages.length > FIT_LIMITS.maxLaps) fail();
    const ordered = [...messages].sort((left, right) =>
        requireNumber(left.startTime) - requireNumber(right.startTime)
        || left.encounter - right.encounter
    );
    return ordered.map((message, index) => {
        if (
            !has(message, 'startTime')
            || message.startTime === null
            || !has(message, 'totalElapsedTime')
            || message.totalElapsedTime === null
        ) fail();
        const lap = {
            id: `${activityId}:lap:${index}`,
            activityId,
            index,
            startOffsetSeconds: activityOffset(message.startTime, sessionStart),
            elapsedTimeSeconds: requireNumber(message.totalElapsedTime)
        };
        setOptional(lap, 'movingTimeSeconds', message, 'totalTimerTime');
        setOptional(lap, 'distanceMeters', message, 'totalDistance');
        return lap;
    });
}

function buildEvents(messages, activityId, sessionStart, warnings) {
    if (messages.length > FIT_LIMITS.maxEvents) fail();
    const ordered = [...messages].sort((left, right) =>
        requireNumber(left.timestamp) - requireNumber(right.timestamp)
        || left.encounter - right.encounter
    );
    let state = 'not-started';
    return ordered.map((message, index) => {
        if (
            !has(message, 'timestamp')
            || message.timestamp === null
            || !has(message, 'event')
            || message.event === null
            || !has(message, 'eventType')
            || message.eventType === null
        ) fail();
        let type;
        let sourceType;
        if (message.event === 0 && message.eventType === 0) {
            if (state === 'not-started') {
                type = 'start';
                state = 'active';
            } else if (state === 'paused') {
                type = 'resume';
                state = 'active';
            } else fail();
        } else if (message.event === 0 && message.eventType === 1) {
            if (state !== 'active') fail();
            type = 'pause';
            state = 'paused';
        } else if (message.event === 0 && message.eventType === 4) {
            if (state !== 'active' && state !== 'paused') fail();
            type = 'stop';
            state = 'stopped';
        } else if (message.eventType === 3) {
            type = 'marker';
        } else {
            type = 'unknown';
            sourceType = 'fit-event';
            addWarning(warnings, 'FIT_EVENT_UNMAPPED');
        }
        const event = {
            id: `${activityId}:event:${index}`,
            activityId,
            index,
            type,
            offsetSeconds: activityOffset(message.timestamp, sessionStart)
        };
        if (sourceType) event.sourceType = sourceType;
        return event;
    });
}

function buildDevices(messages, activityId, warnings) {
    const byIndex = new Map();
    for (const message of [...messages].sort((left, right) => left.encounter - right.encounter)) {
        if (!has(message, 'deviceIndex') || message.deviceIndex === null) fail();
        const index = requireNumber(message.deviceIndex);
        if (!Number.isSafeInteger(index) || index < 0) fail();
        const manufacturer = mapManufacturer(message.manufacturer, warnings);
        const model = has(message, 'productName') ? message.productName : null;
        const current = byIndex.get(index);
        if (current) {
            if (
                manufacturer !== null
                && current.manufacturer !== null
                && current.manufacturer !== manufacturer
            ) fail();
            if (model !== null && current.model !== null && current.model !== model) fail();
            if (current.manufacturer === null) current.manufacturer = manufacturer;
            if (current.model === null) current.model = model;
        } else {
            if (byIndex.size >= FIT_LIMITS.maxDevices) fail();
            byIndex.set(index, { index, manufacturer, model });
        }
    }
    return [...byIndex.values()]
        .sort((left, right) => left.index - right.index)
        .map(item => {
            const device = { id: `${activityId}:device:${item.index}` };
            if (item.manufacturer !== null) device.manufacturer = item.manufacturer;
            if (item.model !== null) device.model = item.model;
            return device;
        });
}

function buildBundle(parsed) {
    if (parsed.fileIds.length !== 1 || parsed.sessions.length !== 1) fail();
    const fileId = parsed.fileIds[0];
    const session = parsed.sessions[0];
    if (fileId.type !== 4 || !has(session, 'startTime') || session.startTime === null) fail();
    const sessionStart = requireNumber(session.startTime);
    if (!Number.isSafeInteger(sessionStart) || sessionStart < 0) fail();
    const identity = [
        safeIdentityPart(fileId.manufacturer),
        safeIdentityPart(fileId.product),
        safeIdentityPart(fileId.number),
        safeIdentityPart(fileId.timeCreated),
        safeIdentityPart(sessionStart)
    ].join(':');
    const activityId = `fit-session:${identity}`;
    const recordRows = buildRecordRows(parsed.records, sessionStart);
    const streams = buildStreams(
        activityId,
        recordRows,
        parsed.hrMessages,
        sessionStart
    );
    const laps = buildLaps(parsed.laps, activityId, sessionStart);
    const events = buildEvents(parsed.events, activityId, sessionStart, parsed.warnings);
    const devices = buildDevices(parsed.devices, activityId, parsed.warnings);
    const sport = mapSport(session, parsed.warnings);
    const streamTypes = new Set(streams.series.map(item => item.streamType));

    addWarning(parsed.warnings, 'FIT_TIMEZONE_UNAVAILABLE');
    addWarning(parsed.warnings, 'FIT_IMPORT_TIME_FALLBACK');
    const activity = {
        schemaVersion: 1,
        id: activityId,
        sportCategory: sport.category,
        sportVariant: sport.variant,
        startTimeUtc: fitTimestampToIso(sessionStart),
        timeZone: { ianaName: null, utcOffsetMinutes: null },
        capabilities: {
            hasGps: streamTypes.has('position'),
            hasHeartRate: streamTypes.has('heartRate'),
            hasPower: streamTypes.has('power'),
            hasCadence: streamTypes.has('cadence'),
            hasLaps: laps.length > 0
        }
    };
    setOptional(activity, 'distanceMeters', session, 'totalDistance');
    setOptional(activity, 'movingTimeSeconds', session, 'totalTimerTime');
    setOptional(activity, 'elapsedTimeSeconds', session, 'totalElapsedTime');
    setOptional(activity, 'elevationGainMeters', session, 'totalAscent');
    setOptional(activity, 'averageHeartRateBpm', session, 'averageHeartRate');
    setOptional(activity, 'averagePowerWatts', session, 'averagePower');
    setOptional(activity, 'averageCadence', session, 'averageCadence');
    if (has(session, 'poolLength')) {
        activity.extensions = { fit: { poolLengthMeters: session.poolLength } };
    }

    const creatorDeviceId = devices.find(device =>
        device.id.endsWith(':device:0')
    )?.id ?? null;
    const source = {
        id: `${activityId}:source:0`,
        activityId,
        provider: 'fit',
        externalId: null,
        rawArtifactId: null,
        acquisitionMethod: 'local-file',
        deviceId: creatorDeviceId,
        importedAt: activity.startTimeUtc
    };
    const bundle = {
        schemaVersion: 1,
        activity,
        streams,
        laps,
        events,
        sources: [source],
        devices,
        warnings: sortedWarnings(parsed.warnings),
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'fit-1.0.0'
        }
    };
    const validation = validateImportedActivityBundle(bundle);
    if (!validation.ok) fail();
    return deepFreeze(bundle);
}

export const fitDecoder = Object.freeze({
    id: 'fit',
    mediaType: FIT_MEDIA_TYPE,
    decode(input) {
        const values = ownDataValues(input, INPUT_FIELDS);
        if (!values) fail();
        if (
            typeof values.mediaType !== 'string'
            || typeof values.content !== 'string'
            || values.content.length > Math.ceil(FIT_LIMITS.maxDecodedBytes / 3) * 4
        ) fail();
        try {
            structuredClone(input);
        } catch {
            fail();
        }
        if (values.mediaType !== FIT_MEDIA_TYPE) {
            fail(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT);
        }
        try {
            return buildBundle(parseFit(decodeBase64(values.content)));
        } catch (error) {
            if (error instanceof ImportError) throw error;
            fail();
        }
    }
});
