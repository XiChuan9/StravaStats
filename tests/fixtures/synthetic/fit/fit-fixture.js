const BASE64_ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const FIT_START_TIMESTAMP = 1_123_456_000;

export const FIT_TYPES = Object.freeze({
    enum: Object.freeze({ byte: 0x00, size: 1, invalid: 0xff }),
    sint8: Object.freeze({ byte: 0x01, size: 1, invalid: 0x7f }),
    uint8: Object.freeze({ byte: 0x02, size: 1, invalid: 0xff }),
    sint16: Object.freeze({ byte: 0x83, size: 2, invalid: 0x7fff }),
    uint16: Object.freeze({ byte: 0x84, size: 2, invalid: 0xffff }),
    sint32: Object.freeze({ byte: 0x85, size: 4, invalid: 0x7fffffff }),
    uint32: Object.freeze({ byte: 0x86, size: 4, invalid: 0xffffffff }),
    string: Object.freeze({ byte: 0x07, size: 1, invalid: 0 }),
    float32: Object.freeze({ byte: 0x88, size: 4, invalid: null }),
    float64: Object.freeze({ byte: 0x89, size: 8, invalid: null }),
    uint8z: Object.freeze({ byte: 0x0a, size: 1, invalid: 0 }),
    uint16z: Object.freeze({ byte: 0x8b, size: 2, invalid: 0 }),
    uint32z: Object.freeze({ byte: 0x8c, size: 4, invalid: 0 }),
    byte: Object.freeze({ byte: 0x0d, size: 1, invalid: 0xff }),
    sint64: Object.freeze({ byte: 0x8e, size: 8, invalid: null }),
    uint64: Object.freeze({ byte: 0x8f, size: 8, invalid: null }),
    uint64z: Object.freeze({ byte: 0x90, size: 8, invalid: 0n })
});

export function fitField(number, type, size = FIT_TYPES[type]?.size) {
    if (!FIT_TYPES[type] || !Number.isInteger(size) || size <= 0) {
        throw new TypeError('Invalid synthetic FIT field.');
    }
    return Object.freeze({ number, type, size });
}

export function fitDefinition(
    localMessage,
    globalMessage,
    fields,
    { architecture = 0, developerFields = [] } = {}
) {
    return Object.freeze({
        kind: 'definition',
        localMessage,
        globalMessage,
        architecture,
        fields,
        developerFields
    });
}

export function fitData(localMessage, values, developerBytes = []) {
    return Object.freeze({ kind: 'data', localMessage, values, developerBytes });
}

export function fitCompressed(localMessage, timeOffset, values, developerBytes = []) {
    return Object.freeze({
        kind: 'compressed',
        localMessage,
        timeOffset,
        values,
        developerBytes
    });
}

export function fitRawRecord(bytes) {
    return Object.freeze({ kind: 'raw', bytes });
}

function pushUint16(target, value, littleEndian) {
    if (littleEndian) target.push(value & 0xff, value >>> 8 & 0xff);
    else target.push(value >>> 8 & 0xff, value & 0xff);
}

function pushUint32(target, value, littleEndian) {
    if (littleEndian) {
        target.push(
            value & 0xff,
            value >>> 8 & 0xff,
            value >>> 16 & 0xff,
            value >>> 24 & 0xff
        );
    } else {
        target.push(
            value >>> 24 & 0xff,
            value >>> 16 & 0xff,
            value >>> 8 & 0xff,
            value & 0xff
        );
    }
}

function pushBigInt(target, value, littleEndian) {
    let remaining = BigInt.asUintN(64, value);
    const bytes = [];
    for (let index = 0; index < 8; index += 1) {
        bytes.push(Number(remaining & 0xffn));
        remaining >>= 8n;
    }
    target.push(...(littleEndian ? bytes : bytes.reverse()));
}

function pushScalar(target, value, type, littleEndian) {
    const definition = FIT_TYPES[type];
    const actual = value === null ? definition.invalid : value;
    if (definition.size === 1) {
        target.push(Number(actual) & 0xff);
    } else if (definition.size === 2) {
        pushUint16(target, Number(actual) & 0xffff, littleEndian);
    } else if (definition.size === 4 && type === 'float32') {
        const buffer = new ArrayBuffer(4);
        new DataView(buffer).setFloat32(0, Number(actual), littleEndian);
        target.push(...new Uint8Array(buffer));
    } else if (definition.size === 8 && type === 'float64') {
        const buffer = new ArrayBuffer(8);
        new DataView(buffer).setFloat64(0, Number(actual), littleEndian);
        target.push(...new Uint8Array(buffer));
    } else if (definition.size === 4) {
        pushUint32(target, Number(actual) >>> 0, littleEndian);
    } else if (definition.size === 8) {
        pushBigInt(target, BigInt(actual), littleEndian);
    } else {
        throw new TypeError('Unsupported synthetic FIT type.');
    }
}

function encodeField(target, field, value, littleEndian) {
    const definition = FIT_TYPES[field.type];
    if (field.type === 'string') {
        const bytes = value === null
            ? new Uint8Array()
            : new TextEncoder().encode(value);
        if (bytes.length >= field.size) throw new RangeError('Synthetic FIT string is too long.');
        target.push(...bytes, ...new Array(field.size - bytes.length).fill(0));
        return;
    }
    const count = field.size / definition.size;
    const values = Array.isArray(value) ? value : [value];
    if (!Number.isInteger(count) || values.length !== count) {
        throw new RangeError('Synthetic FIT array size does not match its definition.');
    }
    for (const item of values) pushScalar(target, item, field.type, littleEndian);
}

function buildDefinition(record, definitions) {
    const target = [];
    const developer = record.developerFields.length > 0;
    target.push(0x40 | (developer ? 0x20 : 0) | record.localMessage);
    target.push(0, record.architecture);
    pushUint16(target, record.globalMessage, record.architecture === 0);
    target.push(record.fields.length);
    for (const field of record.fields) {
        target.push(field.number, field.size, FIT_TYPES[field.type].byte);
    }
    if (developer) {
        target.push(record.developerFields.length);
        for (const field of record.developerFields) {
            target.push(field.number, field.size, field.developerIndex);
        }
    }
    definitions.set(record.localMessage, record);
    return target;
}

function buildData(record, definitions) {
    const definition = definitions.get(record.localMessage);
    if (!definition) throw new TypeError('Synthetic FIT data lacks a definition.');
    const target = [];
    if (record.kind === 'compressed') {
        target.push(0x80 | record.localMessage << 5 | record.timeOffset & 0x1f);
    } else target.push(record.localMessage);
    for (const field of definition.fields) {
        if (record.kind === 'compressed' && field.number === 253) continue;
        encodeField(
            target,
            field,
            Object.hasOwn(record.values, field.number)
                ? record.values[field.number]
                : null,
            definition.architecture === 0
        );
    }
    const expectedDeveloperBytes = definition.developerFields.reduce(
        (total, field) => total + field.size,
        0
    );
    if (record.developerBytes.length !== expectedDeveloperBytes) {
        throw new RangeError('Synthetic developer bytes do not match their definition.');
    }
    target.push(...record.developerBytes);
    return target;
}

export function calculateSyntheticFitCrc(bytes, start = 0, end = bytes.length) {
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

export function createFitBytes({
    records,
    headerSize = 14,
    protocolVersion = 0x20,
    profileVersion = 21208,
    corruptHeaderCrc = false,
    corruptFileCrc = false
}) {
    const definitions = new Map();
    const data = [];
    for (const record of records) {
        if (record.kind === 'raw') {
            for (const byte of record.bytes) data.push(byte);
        }
        else if (record.kind === 'definition') {
            data.push(...buildDefinition(record, definitions));
        } else data.push(...buildData(record, definitions));
    }
    const header = new Array(headerSize).fill(0);
    header[0] = headerSize;
    header[1] = protocolVersion;
    header[2] = profileVersion & 0xff;
    header[3] = profileVersion >>> 8 & 0xff;
    header[4] = data.length & 0xff;
    header[5] = data.length >>> 8 & 0xff;
    header[6] = data.length >>> 16 & 0xff;
    header[7] = data.length >>> 24 & 0xff;
    header[8] = 0x2e;
    header[9] = 0x46;
    header[10] = 0x49;
    header[11] = 0x54;
    if (headerSize === 14) {
        let headerCrc = calculateSyntheticFitCrc(header, 0, 12);
        if (corruptHeaderCrc) headerCrc ^= 1;
        header[12] = headerCrc & 0xff;
        header[13] = headerCrc >>> 8 & 0xff;
    }
    const withoutFileCrc = Uint8Array.from([...header, ...data]);
    let fileCrc = calculateSyntheticFitCrc(withoutFileCrc);
    if (corruptFileCrc) fileCrc ^= 1;
    return Uint8Array.from([
        ...withoutFileCrc,
        fileCrc & 0xff,
        fileCrc >>> 8 & 0xff
    ]);
}

export function syntheticFitBase64(bytes) {
    let result = '';
    for (let offset = 0; offset < bytes.length; offset += 3) {
        const remaining = bytes.length - offset;
        const value = bytes[offset] << 16
            | (remaining > 1 ? bytes[offset + 1] << 8 : 0)
            | (remaining > 2 ? bytes[offset + 2] : 0);
        result += BASE64_ALPHABET[value >>> 18 & 0x3f];
        result += BASE64_ALPHABET[value >>> 12 & 0x3f];
        result += remaining > 1 ? BASE64_ALPHABET[value >>> 6 & 0x3f] : '=';
        result += remaining > 2 ? BASE64_ALPHABET[value & 0x3f] : '=';
    }
    return result;
}

export function syntheticFitDescriptor(bytes) {
    return {
        mediaType: 'application/vnd.ant.fit;base64',
        content: syntheticFitBase64(bytes)
    };
}

export function createSyntheticFitRecords(options = {}) {
    const {
        manufacturer = 1,
        product = 100,
        productName = 'Synthetic Device',
        sport = 1,
        subSport = 0,
        includeGps = true,
        includeHeartRate = true,
        includePower = true,
        includeCadence = true,
        includeLap = true,
        includeHrMessage = false,
        splitRecords = false,
        pauseResume = false,
        poolLength = undefined
    } = options;
    const start = options.start ?? FIT_START_TIMESTAMP;
    const records = [
        fitDefinition(0, 0, [
            fitField(0, 'enum'),
            fitField(1, 'uint16'),
            fitField(2, 'uint16'),
            fitField(4, 'uint32'),
            fitField(5, 'uint16')
        ]),
        fitData(0, {
            0: 4,
            1: manufacturer,
            2: product,
            4: start - 60,
            5: 7
        }),
        fitDefinition(1, 23, [
            fitField(253, 'uint32'),
            fitField(0, 'uint8'),
            fitField(2, 'uint16'),
            fitField(27, 'string', 24)
        ]),
        fitData(1, {
            253: start,
            0: 0,
            2: manufacturer,
            27: productName
        }),
        fitDefinition(2, 21, [
            fitField(253, 'uint32'),
            fitField(0, 'enum'),
            fitField(1, 'enum')
        ]),
        fitData(2, { 253: start, 0: 0, 1: 0 })
    ];

    const recordFields = [fitField(253, 'uint32')];
    if (includeGps) recordFields.push(fitField(0, 'sint32'), fitField(1, 'sint32'));
    if (includeHeartRate && !splitRecords) recordFields.push(fitField(3, 'uint8'));
    if (includeCadence && !splitRecords) recordFields.push(fitField(4, 'uint8'));
    recordFields.push(fitField(5, 'uint32'), fitField(6, 'uint16'));
    if (includePower && !splitRecords) recordFields.push(fitField(7, 'uint16'));
    records.push(fitDefinition(3, 20, recordFields));
    const firstRecord = { 253: start, 5: 0, 6: 2500 };
    const secondRecord = { 253: start + 10, 5: 100000, 6: 3000 };
    if (includeGps) {
        firstRecord[0] = 476_741_370;
        firstRecord[1] = 1_405_249_550;
        secondRecord[0] = 476_741_600;
        secondRecord[1] = 1_405_249_900;
    }
    if (includeHeartRate && !splitRecords) {
        firstRecord[3] = 140;
        secondRecord[3] = 150;
    }
    if (includeCadence && !splitRecords) {
        firstRecord[4] = 0;
        secondRecord[4] = 88;
    }
    if (includePower && !splitRecords) {
        firstRecord[7] = 0;
        secondRecord[7] = 240;
    }
    records.push(fitData(3, firstRecord), fitData(3, secondRecord));
    if (splitRecords) {
        const splitFields = [fitField(253, 'uint32')];
        if (includeHeartRate) splitFields.push(fitField(3, 'uint8'));
        if (includeCadence) splitFields.push(fitField(4, 'uint8'));
        if (includePower) splitFields.push(fitField(7, 'uint16'));
        records.push(fitDefinition(7, 20, splitFields));
        const splitFirst = { 253: start };
        const splitSecond = { 253: start + 10 };
        if (includeHeartRate) {
            splitFirst[3] = 140;
            splitSecond[3] = 150;
        }
        if (includeCadence) {
            splitFirst[4] = 0;
            splitSecond[4] = 88;
        }
        if (includePower) {
            splitFirst[7] = 0;
            splitSecond[7] = 240;
        }
        records.push(fitData(7, splitFirst), fitData(7, splitSecond));
    }
    if (includeHrMessage) {
        records.push(
            fitDefinition(8, 132, [
                fitField(253, 'uint32'),
                fitField(0, 'uint16'),
                fitField(6, 'uint8'),
                fitField(9, 'uint32')
            ]),
            fitData(8, {
                253: start + 5,
                0: 0,
                6: 155,
                9: 100 * 1024
            })
        );
    }
    if (includeLap) {
        records.push(
            fitDefinition(4, 19, [
                fitField(2, 'uint32'),
                fitField(7, 'uint32'),
                fitField(8, 'uint32'),
                fitField(9, 'uint32')
            ]),
            fitData(4, {
                2: start,
                7: 30_000,
                8: 25_000,
                9: 100_000
            })
        );
    }
    if (pauseResume) {
        records.push(
            fitData(2, { 253: start + 10, 0: 0, 1: 1 }),
            fitData(2, { 253: start + 20, 0: 0, 1: 0 })
        );
    }
    records.push(fitData(2, { 253: start + 30, 0: 0, 1: 4 }));
    const sessionFields = [
        fitField(253, 'uint32'),
        fitField(2, 'uint32'),
        fitField(5, 'enum'),
        fitField(6, 'enum'),
        fitField(7, 'uint32'),
        fitField(8, 'uint32'),
        fitField(9, 'uint32'),
        fitField(16, 'uint8'),
        fitField(18, 'uint8'),
        fitField(20, 'uint16'),
        fitField(22, 'uint16')
    ];
    if (poolLength !== undefined) sessionFields.push(fitField(44, 'uint16'));
    records.push(fitDefinition(5, 18, sessionFields));
    const sessionValues = {
        253: start + 30,
        2: start,
        5: sport,
        6: subSport,
        7: 30_000,
        8: 25_000,
        9: 100_000,
        16: includeHeartRate || includeHrMessage ? 145 : null,
        18: includeCadence ? 80 : null,
        20: includePower ? 200 : null,
        22: 12
    };
    if (poolLength !== undefined) sessionValues[44] = poolLength;
    records.push(fitData(5, sessionValues));
    return records;
}

export function createSyntheticFitActivity(options = {}) {
    return createFitBytes({
        records: createSyntheticFitRecords(options),
        headerSize: options.headerSize ?? 14,
        corruptHeaderCrc: options.corruptHeaderCrc ?? false,
        corruptFileCrc: options.corruptFileCrc ?? false
    });
}
