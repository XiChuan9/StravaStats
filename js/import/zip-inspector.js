import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { deepFreeze } from './safe-data.js';

export const STRAVA_ZIP_LIMITS = deepFreeze({
    maxArchiveBytes: 67_108_864,
    maxEntries: 10_000,
    maxCompressedEntryBytes: 16_777_216,
    maxUncompressedEntryBytes: 16_777_216,
    maxTotalUncompressedBytes: 268_435_456,
    maxCompressionRatio: 100,
    maxDirectoryDepth: 4,
    maxFilenameBytes: 240,
    maxProcessingMilliseconds: 10_000,
    checkQuantumBytes: 65_536
});

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const SPANNED_SIGNATURE = 0x08074b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const UTF8_FLAG = 0x0800;
const DATA_DESCRIPTOR_FLAG = 0x0008;
const ENCRYPTED_FLAG = 0x0001;
const ALLOWED_FLAGS = UTF8_FLAG;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
    return value >>> 0;
}));

function fail(code) {
    throw importError(code, false, 'archive');
}

function safeErrorCode(error) {
    try {
        const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function read16(view, offset) {
    if (offset < 0 || offset + 2 > view.byteLength) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    return view.getUint16(offset, true);
}

function read32(view, offset) {
    if (offset < 0 || offset + 4 > view.byteLength) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    return view.getUint32(offset, true);
}

function decodeBase64(value) {
    const maximumEncodedLength = Math.ceil(STRAVA_ZIP_LIMITS.maxArchiveBytes / 3) * 4;
    if (
        typeof value !== 'string'
        || value.length === 0
        || value.length > maximumEncodedLength
        || value.length % 4 !== 0
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    ) fail(IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING);
    let decoded;
    try {
        decoded = atob(value);
    } catch {
        fail(IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING);
    }
    if (
        decoded.length === 0
        || decoded.length > STRAVA_ZIP_LIMITS.maxArchiveBytes
        || btoa(decoded) !== value
    ) fail(IMPORT_ERROR_CODE.ZIP_INVALID_ENCODING);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
        bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
}

function equalBytes(left, right) {
    return left.byteLength === right.byteLength
        && left.every((value, index) => value === right[index]);
}

function decodeFilename(bytes, utf8) {
    if (bytes.byteLength === 0 || bytes.byteLength > STRAVA_ZIP_LIMITS.maxFilenameBytes) {
        fail(IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);
    }
    let value;
    if (utf8) {
        try {
            value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
            fail(IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
        }
        if (!equalBytes(new TextEncoder().encode(value), bytes)) {
            fail(IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
        }
    } else {
        if ([...bytes].some(byte => byte < 0x20 || byte > 0x7e)) {
            fail(IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
        }
        value = String.fromCharCode(...bytes);
    }
    if (value.normalize('NFC') !== value) fail(IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
    return value;
}

function validatePath(name) {
    if (
        name.includes('\0')
        || name.includes('\\')
        || name.startsWith('/')
        || name.startsWith('//')
        || /^[A-Za-z]:/.test(name)
    ) fail(IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
    const directory = name.endsWith('/');
    const body = directory ? name.slice(0, -1) : name;
    const segments = body.split('/');
    if (
        body.length === 0
        || segments.length > STRAVA_ZIP_LIMITS.maxDirectoryDepth
        || segments.some(segment => segment === '' || segment === '.' || segment === '..')
    ) fail(IMPORT_ERROR_CODE.ZIP_PATH_INVALID);
    if (!directory && /(?:^|\/)activities\.csv$/i.test(name) && name !== 'activities.csv') {
        // Non-root or differently-cased lookalikes are inert entries, not the manifest.
    }
    if (!directory && /\.(?:zip|zipx|7z|rar|tar|tgz|tar\.gz)$/i.test(name)) {
        fail(IMPORT_ERROR_CODE.ZIP_NESTED_ARCHIVE);
    }
    return directory;
}

function validateEntryKind(versionMadeBy, externalAttributes, directory) {
    const creator = versionMadeBy >>> 8;
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const unixType = unixMode & 0xf000;
    const dosAttributes = externalAttributes & 0xff;
    if (![0, 3].includes(creator)) fail(IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
    if ((dosAttributes & 0x08) !== 0) fail(IMPORT_ERROR_CODE.ZIP_SPECIAL_FILE);
    if (creator === 3 && unixType !== 0) {
        const expected = directory ? 0x4000 : 0x8000;
        if (unixType !== expected) fail(IMPORT_ERROR_CODE.ZIP_SPECIAL_FILE);
    }
    if (directory !== ((dosAttributes & 0x10) !== 0) && dosAttributes !== 0) {
        fail(IMPORT_ERROR_CODE.ZIP_SPECIAL_FILE);
    }
}

function validateFlags(flags, method) {
    if ((flags & ENCRYPTED_FLAG) !== 0) fail(IMPORT_ERROR_CODE.ZIP_ENCRYPTED);
    if ((flags & DATA_DESCRIPTOR_FLAG) !== 0) {
        fail(IMPORT_ERROR_CODE.ZIP_DATA_DESCRIPTOR_UNSUPPORTED);
    }
    const allowed = method === METHOD_DEFLATE ? ALLOWED_FLAGS | 0x0006 : ALLOWED_FLAGS;
    if ((flags & ~allowed) !== 0) fail(IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
}

function validateSizes(compressedSize, uncompressedSize, method) {
    if (
        compressedSize > STRAVA_ZIP_LIMITS.maxCompressedEntryBytes
        || uncompressedSize > STRAVA_ZIP_LIMITS.maxUncompressedEntryBytes
    ) fail(IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);
    if (method === METHOD_STORED && compressedSize !== uncompressedSize) {
        fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    }
    if (
        uncompressedSize > 0
        && (compressedSize === 0
            || uncompressedSize > compressedSize * STRAVA_ZIP_LIMITS.maxCompressionRatio)
    ) fail(IMPORT_ERROR_CODE.ZIP_BOMB_RISK);
}

function parseArchive(bytes) {
    if (bytes.byteLength < 22) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocdOffset = bytes.byteLength - 22;
    if (read32(view, eocdOffset) !== EOCD_SIGNATURE || read16(view, eocdOffset + 20) !== 0) {
        fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    }
    if (eocdOffset >= 20 && read32(view, eocdOffset - 20) === ZIP64_LOCATOR_SIGNATURE) {
        fail(IMPORT_ERROR_CODE.ZIP64_UNSUPPORTED);
    }
    if (read32(view, 0) === SPANNED_SIGNATURE) {
        fail(IMPORT_ERROR_CODE.ZIP_MULTI_DISK);
    }
    const disk = read16(view, eocdOffset + 4);
    const centralDisk = read16(view, eocdOffset + 6);
    const entriesOnDisk = read16(view, eocdOffset + 8);
    const totalEntries = read16(view, eocdOffset + 10);
    const centralSize = read32(view, eocdOffset + 12);
    const centralOffset = read32(view, eocdOffset + 16);
    if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
        fail(IMPORT_ERROR_CODE.ZIP_MULTI_DISK);
    }
    if (
        entriesOnDisk === ZIP64_SENTINEL_16
        || totalEntries === ZIP64_SENTINEL_16
        || centralSize === ZIP64_SENTINEL_32
        || centralOffset === ZIP64_SENTINEL_32
    ) fail(IMPORT_ERROR_CODE.ZIP64_UNSUPPORTED);
    if (totalEntries === 0 || totalEntries > STRAVA_ZIP_LIMITS.maxEntries) {
        fail(IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);
    }
    if (centralOffset + centralSize !== eocdOffset) fail(IMPORT_ERROR_CODE.ZIP_INVALID);

    const entries = [];
    const exactNames = new Set();
    const foldedNames = new Set();
    let cursor = centralOffset;
    let totalUncompressed = 0;
    let totalCompressed = 0;
    let manifestCount = 0;
    for (let ordinal = 0; ordinal < totalEntries; ordinal += 1) {
        if (read32(view, cursor) !== CENTRAL_SIGNATURE || cursor + 46 > eocdOffset) {
            fail(IMPORT_ERROR_CODE.ZIP_INVALID);
        }
        const versionMadeBy = read16(view, cursor + 4);
        const versionNeeded = read16(view, cursor + 6);
        const flags = read16(view, cursor + 8);
        const method = read16(view, cursor + 10);
        const modifiedTime = read16(view, cursor + 12);
        const modifiedDate = read16(view, cursor + 14);
        const crc32 = read32(view, cursor + 16);
        const compressedSize = read32(view, cursor + 20);
        const uncompressedSize = read32(view, cursor + 24);
        const filenameLength = read16(view, cursor + 28);
        const extraLength = read16(view, cursor + 30);
        const commentLength = read16(view, cursor + 32);
        const diskStart = read16(view, cursor + 34);
        const externalAttributes = read32(view, cursor + 38);
        const localOffset = read32(view, cursor + 42);
        if (
            compressedSize === ZIP64_SENTINEL_32
            || uncompressedSize === ZIP64_SENTINEL_32
            || localOffset === ZIP64_SENTINEL_32
        ) fail(IMPORT_ERROR_CODE.ZIP64_UNSUPPORTED);
        if (diskStart !== 0) fail(IMPORT_ERROR_CODE.ZIP_MULTI_DISK);
        validateFlags(flags, method);
        const expectedVersion = method === METHOD_DEFLATE ? 20 : 10;
        if (
            ![METHOD_STORED, METHOD_DEFLATE].includes(method)
            || versionNeeded !== expectedVersion
        ) {
            fail(IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
        }
        if (extraLength !== 0 || commentLength !== 0) {
            fail(IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
        }
        validateSizes(compressedSize, uncompressedSize, method);
        const filenameStart = cursor + 46;
        const filenameEnd = filenameStart + filenameLength;
        if (filenameEnd > eocdOffset) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
        const filenameBytes = bytes.subarray(filenameStart, filenameEnd);
        const name = decodeFilename(filenameBytes, (flags & UTF8_FLAG) !== 0);
        const directory = validatePath(name);
        validateEntryKind(versionMadeBy, externalAttributes, directory);
        if (directory && method !== METHOD_STORED) {
            fail(IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
        }
        if (directory && (compressedSize !== 0 || uncompressedSize !== 0 || crc32 !== 0)) {
            fail(IMPORT_ERROR_CODE.ZIP_INVALID);
        }
        const folded = name.toLowerCase();
        if (exactNames.has(name) || foldedNames.has(folded)) {
            fail(folded === 'activities.csv'
                ? IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_DUPLICATE
                : IMPORT_ERROR_CODE.ZIP_DUPLICATE_ENTRY);
        }
        exactNames.add(name);
        foldedNames.add(folded);
        if (name === 'activities.csv' && !directory) manifestCount += 1;
        totalUncompressed += uncompressedSize;
        totalCompressed += compressedSize;
        if (
            totalUncompressed > STRAVA_ZIP_LIMITS.maxTotalUncompressedBytes
            || !Number.isSafeInteger(totalUncompressed)
        ) fail(IMPORT_ERROR_CODE.ZIP_LIMIT_EXCEEDED);
        entries.push({
            ordinal,
            name,
            directory,
            flags,
            method,
            modifiedTime,
            modifiedDate,
            crc32,
            compressedSize,
            uncompressedSize,
            localOffset,
            filenameBytes: new Uint8Array(filenameBytes)
        });
        cursor = filenameEnd;
    }
    if (cursor !== eocdOffset) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    if (manifestCount === 0) fail(IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_MISSING);
    if (manifestCount !== 1) fail(IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_DUPLICATE);
    if (
        totalUncompressed > 0
        && (totalCompressed === 0
            || totalUncompressed > totalCompressed * STRAVA_ZIP_LIMITS.maxCompressionRatio)
    ) fail(IMPORT_ERROR_CODE.ZIP_BOMB_RISK);

    const segments = [];
    for (const entry of entries) {
        const offset = entry.localOffset;
        if (read32(view, offset) !== LOCAL_SIGNATURE || offset + 30 > centralOffset) {
            fail(IMPORT_ERROR_CODE.ZIP_INVALID);
        }
        const versionNeeded = read16(view, offset + 4);
        const flags = read16(view, offset + 6);
        const method = read16(view, offset + 8);
        const modifiedTime = read16(view, offset + 10);
        const modifiedDate = read16(view, offset + 12);
        const crc32 = read32(view, offset + 14);
        const compressedSize = read32(view, offset + 18);
        const uncompressedSize = read32(view, offset + 22);
        const filenameLength = read16(view, offset + 26);
        const extraLength = read16(view, offset + 28);
        const filenameStart = offset + 30;
        const filenameEnd = filenameStart + filenameLength;
        const dataStart = filenameEnd + extraLength;
        const dataEnd = dataStart + compressedSize;
        if (
            versionNeeded !== (entry.method === METHOD_DEFLATE ? 20 : 10)
            || flags !== entry.flags
            || method !== entry.method
            || modifiedTime !== entry.modifiedTime
            || modifiedDate !== entry.modifiedDate
            || crc32 !== entry.crc32
            || compressedSize !== entry.compressedSize
            || uncompressedSize !== entry.uncompressedSize
            || filenameLength !== entry.filenameBytes.byteLength
            || extraLength !== 0
            || filenameEnd > centralOffset
            || dataEnd > centralOffset
            || !equalBytes(bytes.subarray(filenameStart, filenameEnd), entry.filenameBytes)
        ) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
        entry.dataStart = dataStart;
        entry.dataEnd = dataEnd;
        segments.push({ start: offset, end: dataEnd });
    }
    segments.sort((left, right) => left.start - right.start);
    let expectedOffset = 0;
    for (const segment of segments) {
        if (segment.start !== expectedOffset || segment.end < segment.start) {
            fail(IMPORT_ERROR_CODE.ZIP_INVALID);
        }
        expectedOffset = segment.end;
    }
    if (expectedOffset !== centralOffset) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
    entries.forEach(entry => Object.freeze(entry));
    return Object.freeze(entries);
}

async function yieldAndCheck(check) {
    await new Promise(resolve => setTimeout(resolve, 0));
    check();
}

async function checkedCrc(bytes, check) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.byteLength; index += 1) {
        crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
        if (
            (index + 1) % STRAVA_ZIP_LIMITS.checkQuantumBytes === 0
        ) await yieldAndCheck(check);
    }
    check();
    return (crc ^ 0xffffffff) >>> 0;
}

async function inflate(compressed, expectedSize, check) {
    if (typeof DecompressionStream !== 'function') fail(IMPORT_ERROR_CODE.ZIP_UNSUPPORTED);
    let reader;
    try {
        reader = new Blob([compressed])
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))
            .getReader();
        const chunks = [];
        let total = 0;
        while (true) {
            check();
            const result = await reader.read();
            if (result.done) break;
            if (!(result.value instanceof Uint8Array)) fail(IMPORT_ERROR_CODE.ZIP_DECOMPRESSION_FAILED);
            total += result.value.byteLength;
            if (total > expectedSize) {
                await reader.cancel();
                fail(IMPORT_ERROR_CODE.ZIP_DECOMPRESSION_FAILED);
            }
            chunks.push(new Uint8Array(result.value));
            for (
                let checked = 0;
                checked < result.value.byteLength;
                checked += STRAVA_ZIP_LIMITS.checkQuantumBytes
            ) await yieldAndCheck(check);
        }
        if (total !== expectedSize) fail(IMPORT_ERROR_CODE.ZIP_DECOMPRESSION_FAILED);
        const output = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            output.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return output;
    } catch (error) {
        if (Object.values(IMPORT_ERROR_CODE).includes(safeErrorCode(error))) throw error;
        fail(IMPORT_ERROR_CODE.ZIP_DECOMPRESSION_FAILED);
    } finally {
        try {
            reader?.releaseLock();
        } catch {
            // The stable decompression result already owns the outcome.
        }
    }
}

export function openStravaZipArchive(content, isCancelled = () => false) {
    if (typeof isCancelled !== 'function') fail(IMPORT_ERROR_CODE.INVALID_REQUEST);
    const startedAt = Date.now();
    const check = () => {
        let cancelled;
        try {
            cancelled = isCancelled();
        } catch {
            fail(IMPORT_ERROR_CODE.INVALID_REQUEST);
        }
        if (cancelled === true) fail(IMPORT_ERROR_CODE.IMPORT_CANCELLED);
        if (Date.now() - startedAt > STRAVA_ZIP_LIMITS.maxProcessingMilliseconds) {
            fail(IMPORT_ERROR_CODE.ZIP_TIME_BUDGET_EXCEEDED);
        }
    };
    const bytes = decodeBase64(content);
    check();
    const entries = parseArchive(bytes);
    check();
    const acceptedEntries = new Set(entries);
    return Object.freeze({
        entries,
        async extract(entry) {
            if (!acceptedEntries.has(entry) || entry.directory) {
                fail(IMPORT_ERROR_CODE.ZIP_INVALID);
            }
            check();
            const compressed = bytes.subarray(entry.dataStart, entry.dataEnd);
            const output = entry.method === METHOD_STORED
                ? new Uint8Array(compressed)
                : await inflate(compressed, entry.uncompressedSize, check);
            if (output.byteLength !== entry.uncompressedSize) {
                fail(IMPORT_ERROR_CODE.ZIP_DECOMPRESSION_FAILED);
            }
            if (await checkedCrc(output, check) !== entry.crc32) {
                fail(IMPORT_ERROR_CODE.ZIP_CRC_MISMATCH);
            }
            return output;
        }
    });
}
