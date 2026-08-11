const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

export const BACKUP_BYTE_LIMIT = 268_435_456;

const FORMAT_1_ENTRY_PATHS = Object.freeze([
    'manifest.json',
    'activities.jsonl',
    'sources.jsonl',
    'streams/series.jsonl',
    'laps.jsonl',
    'events.jsonl',
    'devices.jsonl',
    'overrides.jsonl',
    'analysis/snapshots.jsonl',
    'settings.json',
    'raw/artifacts.jsonl',
    'system/metadata.jsonl',
    'system/migrations.jsonl',
    'imports/jobs.jsonl',
    'imports/items.jsonl',
    'review/candidates.jsonl',
    'review/decisions.jsonl'
]);

const FORMAT_2_ENTRY_PATHS = Object.freeze([
    'manifest.json',
    'activities.jsonl',
    'sources.jsonl',
    'connections.jsonl',
    ...FORMAT_1_ENTRY_PATHS.slice(3)
]);

const FORMAT_3_ENTRY_PATHS = Object.freeze([
    ...FORMAT_2_ENTRY_PATHS.slice(0, 4),
    'operations/source-manager.jsonl',
    ...FORMAT_2_ENTRY_PATHS.slice(4)
]);

export const BACKUP_ENTRY_PATHS_BY_FORMAT = Object.freeze({
    1: FORMAT_1_ENTRY_PATHS,
    2: FORMAT_2_ENTRY_PATHS,
    3: FORMAT_3_ENTRY_PATHS
});

export const BACKUP_ENTRY_PATHS = FORMAT_3_ENTRY_PATHS;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORED_METHOD = 0;
const ZIP_DOS_TIME = 0;
const ZIP_DOS_DATE = 0x0021;
const ZIP_VERSION_MADE_BY = 0x0314;
const ZIP_VERSION_NEEDED = 10;
const ZIP_EXTERNAL_ATTRIBUTES = 0x81a40000;
const SHA256_EXTRA_ID = 0x5353;
const SHA256_EXTRA_SIZE = 32;
const CENTRAL_EXTRA_SIZE = 4 + SHA256_EXTRA_SIZE;

export class BackupCodecError extends Error {
    constructor(code) {
        super('Backup bytes are invalid.');
        this.name = 'BackupCodecError';
        this.code = code;
        Object.freeze(this);
    }
}

function invalidData() {
    return new BackupCodecError('BACKUP_DATA_INVALID');
}

function invalidContainer() {
    return new BackupCodecError('BACKUP_CONTAINER_INVALID');
}

function hashMismatch() {
    return new BackupCodecError('BACKUP_HASH_MISMATCH');
}

function tooLarge() {
    return new BackupCodecError('BACKUP_TOO_LARGE');
}

function codeUnitCompare(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function ownDataDescriptor(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw invalidData();
    }
    return descriptor;
}

function taggedValue(value, ancestors) {
    if (value === null) return ['n'];
    if (typeof value === 'boolean') return ['b', value];
    if (typeof value === 'string') return ['s', value];
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw invalidData();
        return ['d', Object.is(value, -0) ? '-0' : String(value)];
    }
    if (typeof value !== 'object' || ancestors.has(value)) throw invalidData();
    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype) {
                throw invalidData();
            }
            const keys = Reflect.ownKeys(value);
            if (
                keys.length !== value.length + 1
                || keys.some((key, index) => (
                    index === keys.length - 1
                        ? key !== 'length'
                        : key !== String(index)
                ))
            ) {
                throw invalidData();
            }
            const items = [];
            for (let index = 0; index < value.length; index += 1) {
                items.push(taggedValue(
                    ownDataDescriptor(value, String(index)).value,
                    ancestors
                ));
            }
            return ['a', items];
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw invalidData();
        }
        const keys = Reflect.ownKeys(value);
        if (keys.some(key => typeof key !== 'string')) throw invalidData();
        keys.sort(codeUnitCompare);
        return ['o', keys.map(key => [
            key,
            taggedValue(ownDataDescriptor(value, key).value, ancestors)
        ])];
    } catch (error) {
        if (error instanceof BackupCodecError) throw error;
        throw invalidData();
    } finally {
        ancestors.delete(value);
    }
}

export function encodeTaggedValue(value) {
    try {
        return JSON.stringify(taggedValue(value, new Set()));
    } catch (error) {
        if (error instanceof BackupCodecError) throw error;
        throw invalidData();
    }
}

function exactArray(value, length) {
    if (!Array.isArray(value) || value.length !== length) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === length + 1
        && keys.every((key, index) => (
            index === length ? key === 'length' : key === String(index)
        ));
}

function decodedTaggedValue(node) {
    if (!Array.isArray(node) || node.length < 1 || typeof node[0] !== 'string') {
        throw invalidData();
    }
    if (node[0] === 'n' && exactArray(node, 1)) return null;
    if (
        node[0] === 'b'
        && exactArray(node, 2)
        && typeof node[1] === 'boolean'
    ) return node[1];
    if (
        node[0] === 's'
        && exactArray(node, 2)
        && typeof node[1] === 'string'
    ) return node[1];
    if (node[0] === 'd' && exactArray(node, 2) && typeof node[1] === 'string') {
        if (node[1] === '-0') return -0;
        if (!/^(?:0|-[1-9]\d*|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(node[1])) {
            throw invalidData();
        }
        const number = Number(node[1]);
        if (!Number.isFinite(number) || String(number) !== node[1]) {
            throw invalidData();
        }
        return number;
    }
    if (node[0] === 'a' && exactArray(node, 2) && Array.isArray(node[1])) {
        return node[1].map(decodedTaggedValue);
    }
    if (node[0] === 'o' && exactArray(node, 2) && Array.isArray(node[1])) {
        const result = {};
        let previous = null;
        for (const pair of node[1]) {
            if (
                !exactArray(pair, 2)
                || typeof pair[0] !== 'string'
                || (previous !== null && codeUnitCompare(previous, pair[0]) >= 0)
            ) {
                throw invalidData();
            }
            previous = pair[0];
            Object.defineProperty(result, pair[0], {
                value: decodedTaggedValue(pair[1]),
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        return result;
    }
    throw invalidData();
}

export function decodeTaggedValue(text) {
    if (typeof text !== 'string') throw invalidData();
    let node;
    try {
        node = JSON.parse(text);
    } catch {
        throw invalidData();
    }
    return decodedTaggedValue(node);
}

export function encodeJsonLines(records) {
    if (!Array.isArray(records)) throw invalidData();
    const chunks = [];
    let total = 0;
    for (let index = 0; index < records.length; index += 1) {
        if (!Object.hasOwn(records, String(index))) throw invalidData();
        const bytes = TEXT_ENCODER.encode(`${encodeTaggedValue(records[index])}\n`);
        total += bytes.byteLength;
        if (bytes.byteLength > BACKUP_BYTE_LIMIT || total > BACKUP_BYTE_LIMIT) {
            throw tooLarge();
        }
        chunks.push(bytes);
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return output;
}

export function decodeJsonLines(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > BACKUP_BYTE_LIMIT) {
        throw invalidData();
    }
    let text;
    try {
        text = TEXT_DECODER.decode(bytes);
    } catch {
        throw invalidData();
    }
    if (text.length === 0) return [];
    if (!text.endsWith('\n') || text.includes('\r')) throw invalidData();
    const lines = text.slice(0, -1).split('\n');
    if (lines.some(line => line.length === 0)) throw invalidData();
    return lines.map(decodeTaggedValue);
}

function canonicalNode(value) {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || Object.is(value, -0)) throw invalidData();
        return value;
    }
    if (typeof value !== 'object') throw invalidData();
    if (Array.isArray(value)) return value.map(canonicalNode);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw invalidData();
    const result = {};
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) throw invalidData();
    keys.sort(codeUnitCompare);
    for (const key of keys) {
        Object.defineProperty(result, key, {
            value: canonicalNode(ownDataDescriptor(value, key).value),
            enumerable: true,
            configurable: true,
            writable: true
        });
    }
    return result;
}

export function encodeCanonicalJson(value) {
    return TEXT_ENCODER.encode(JSON.stringify(canonicalNode(value)));
}

export function decodeCanonicalJson(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > BACKUP_BYTE_LIMIT) {
        throw invalidData();
    }
    let text;
    let value;
    try {
        text = TEXT_DECODER.decode(bytes);
        value = JSON.parse(text);
    } catch {
        throw invalidData();
    }
    const canonical = encodeCanonicalJson(value);
    if (canonical.byteLength !== bytes.byteLength) throw invalidData();
    for (let index = 0; index < bytes.byteLength; index += 1) {
        if (canonical[index] !== bytes[index]) throw invalidData();
    }
    return value;
}

function crc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) !== 0
                ? 0xedb88320 ^ (value >>> 1)
                : value >>> 1;
        }
        table[index] = value >>> 0;
    }
    return table;
}

const CRC32_TABLE = crc32Table();

export function crc32(bytes) {
    if (!(bytes instanceof Uint8Array)) throw invalidData();
    let value = 0xffffffff;
    for (const byte of bytes) {
        value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
}

function hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(bytes, crypto) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > BACKUP_BYTE_LIMIT) {
        throw invalidData();
    }
    let digest;
    try {
        digest = await crypto.subtle.digest('SHA-256', bytes);
    } catch {
        throw invalidData();
    }
    const result = new Uint8Array(digest);
    if (result.byteLength !== 32) throw invalidData();
    return result;
}

function writeU16(view, offset, value) {
    view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
}

function readU16(view, offset) {
    if (offset < 0 || offset + 2 > view.byteLength) throw invalidContainer();
    return view.getUint16(offset, true);
}

function readU32(view, offset) {
    if (offset < 0 || offset + 4 > view.byteLength) throw invalidContainer();
    return view.getUint32(offset, true);
}

function exactBytes(left, right) {
    if (left.byteLength !== right.byteLength) return false;
    let difference = 0;
    for (let index = 0; index < left.byteLength; index += 1) {
        difference |= left[index] ^ right[index];
    }
    return difference === 0;
}

function entryProfileFor(entries) {
    if (!Array.isArray(entries)) throw invalidContainer();
    const profiles = Object.values(BACKUP_ENTRY_PATHS_BY_FORMAT);
    return profiles.find(profile => (
        profile.length === entries.length
        && profile.every((path, index) => entries[index]?.path === path)
    ));
}

function normalizedEntries(entries) {
    const paths = entryProfileFor(entries);
    if (!paths) {
        throw invalidContainer();
    }
    return entries.map((entry, index) => {
        const keys = Reflect.ownKeys(entry ?? {});
        if (
            Object.getPrototypeOf(entry) !== Object.prototype
            || keys.length !== 2
            || !keys.includes('path')
            || !keys.includes('bytes')
            || entry.path !== paths[index]
            || !(entry.bytes instanceof Uint8Array)
            || entry.bytes.byteLength > BACKUP_BYTE_LIMIT
        ) {
            throw invalidContainer();
        }
        return { path: entry.path, bytes: entry.bytes };
    });
}

export async function createDeterministicZip(entries, crypto) {
    const normalized = normalizedEntries(entries);
    const prepared = [];
    let localSize = 0;
    let centralSize = 0;
    for (const entry of normalized) {
        const name = TEXT_ENCODER.encode(entry.path);
        const digest = await sha256(entry.bytes, crypto);
        const localLength = 30 + name.byteLength + entry.bytes.byteLength;
        const centralLength = 46 + name.byteLength + CENTRAL_EXTRA_SIZE;
        localSize += localLength;
        centralSize += centralLength;
        if (localSize + centralSize + 22 > BACKUP_BYTE_LIMIT) throw tooLarge();
        prepared.push({
            ...entry,
            name,
            digest,
            crc: crc32(entry.bytes),
            localOffset: localSize - localLength
        });
    }
    const total = localSize + centralSize + 22;
    const output = new Uint8Array(total);
    const view = new DataView(output.buffer);
    let offset = 0;
    for (const entry of prepared) {
        writeU32(view, offset, ZIP_LOCAL_SIGNATURE);
        writeU16(view, offset + 4, ZIP_VERSION_NEEDED);
        writeU16(view, offset + 6, ZIP_UTF8_FLAG);
        writeU16(view, offset + 8, ZIP_STORED_METHOD);
        writeU16(view, offset + 10, ZIP_DOS_TIME);
        writeU16(view, offset + 12, ZIP_DOS_DATE);
        writeU32(view, offset + 14, entry.crc);
        writeU32(view, offset + 18, entry.bytes.byteLength);
        writeU32(view, offset + 22, entry.bytes.byteLength);
        writeU16(view, offset + 26, entry.name.byteLength);
        writeU16(view, offset + 28, 0);
        output.set(entry.name, offset + 30);
        output.set(entry.bytes, offset + 30 + entry.name.byteLength);
        offset += 30 + entry.name.byteLength + entry.bytes.byteLength;
    }
    const centralOffset = offset;
    for (const entry of prepared) {
        writeU32(view, offset, ZIP_CENTRAL_SIGNATURE);
        writeU16(view, offset + 4, ZIP_VERSION_MADE_BY);
        writeU16(view, offset + 6, ZIP_VERSION_NEEDED);
        writeU16(view, offset + 8, ZIP_UTF8_FLAG);
        writeU16(view, offset + 10, ZIP_STORED_METHOD);
        writeU16(view, offset + 12, ZIP_DOS_TIME);
        writeU16(view, offset + 14, ZIP_DOS_DATE);
        writeU32(view, offset + 16, entry.crc);
        writeU32(view, offset + 20, entry.bytes.byteLength);
        writeU32(view, offset + 24, entry.bytes.byteLength);
        writeU16(view, offset + 28, entry.name.byteLength);
        writeU16(view, offset + 30, CENTRAL_EXTRA_SIZE);
        writeU16(view, offset + 32, 0);
        writeU16(view, offset + 34, 0);
        writeU16(view, offset + 36, 0);
        writeU32(view, offset + 38, ZIP_EXTERNAL_ATTRIBUTES);
        writeU32(view, offset + 42, entry.localOffset);
        output.set(entry.name, offset + 46);
        const extraOffset = offset + 46 + entry.name.byteLength;
        writeU16(view, extraOffset, SHA256_EXTRA_ID);
        writeU16(view, extraOffset + 2, SHA256_EXTRA_SIZE);
        output.set(entry.digest, extraOffset + 4);
        offset += 46 + entry.name.byteLength + CENTRAL_EXTRA_SIZE;
    }
    writeU32(view, offset, ZIP_END_SIGNATURE);
    writeU16(view, offset + 4, 0);
    writeU16(view, offset + 6, 0);
    writeU16(view, offset + 8, prepared.length);
    writeU16(view, offset + 10, prepared.length);
    writeU32(view, offset + 12, centralSize);
    writeU32(view, offset + 16, centralOffset);
    writeU16(view, offset + 20, 0);
    return output;
}

export async function parseDeterministicZip(bytes, crypto) {
    if (!(bytes instanceof Uint8Array)) throw invalidContainer();
    if (bytes.byteLength > BACKUP_BYTE_LIMIT) throw tooLarge();
    if (bytes.byteLength < 22) throw invalidContainer();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset = bytes.byteLength - 22;
    const entryCount = readU16(view, endOffset + 8);
    const paths = Object.values(BACKUP_ENTRY_PATHS_BY_FORMAT).find(profile => (
        profile.length === entryCount
    ));
    if (
        readU32(view, endOffset) !== ZIP_END_SIGNATURE
        || readU16(view, endOffset + 4) !== 0
        || readU16(view, endOffset + 6) !== 0
        || !paths
        || readU16(view, endOffset + 10) !== entryCount
        || readU16(view, endOffset + 20) !== 0
    ) throw invalidContainer();
    const centralSize = readU32(view, endOffset + 12);
    const centralOffset = readU32(view, endOffset + 16);
    if (centralOffset + centralSize !== endOffset) throw invalidContainer();
    const entries = [];
    let offset = centralOffset;
    for (let index = 0; index < paths.length; index += 1) {
        if (
            readU32(view, offset) !== ZIP_CENTRAL_SIGNATURE
            || readU16(view, offset + 4) !== ZIP_VERSION_MADE_BY
            || readU16(view, offset + 6) !== ZIP_VERSION_NEEDED
            || readU16(view, offset + 8) !== ZIP_UTF8_FLAG
            || readU16(view, offset + 10) !== ZIP_STORED_METHOD
            || readU16(view, offset + 12) !== ZIP_DOS_TIME
            || readU16(view, offset + 14) !== ZIP_DOS_DATE
            || readU16(view, offset + 30) !== CENTRAL_EXTRA_SIZE
            || readU16(view, offset + 32) !== 0
            || readU16(view, offset + 34) !== 0
            || readU16(view, offset + 36) !== 0
            || readU32(view, offset + 38) !== ZIP_EXTERNAL_ATTRIBUTES
        ) throw invalidContainer();
        const crc = readU32(view, offset + 16);
        const compressedSize = readU32(view, offset + 20);
        const uncompressedSize = readU32(view, offset + 24);
        const nameLength = readU16(view, offset + 28);
        const localOffset = readU32(view, offset + 42);
        if (
            compressedSize !== uncompressedSize
            || uncompressedSize > BACKUP_BYTE_LIMIT
            || offset + 46 + nameLength + CENTRAL_EXTRA_SIZE > endOffset
        ) throw invalidContainer();
        let path;
        try {
            path = TEXT_DECODER.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        } catch {
            throw invalidContainer();
        }
        if (path !== paths[index]) throw invalidContainer();
        const extraOffset = offset + 46 + nameLength;
        if (
            readU16(view, extraOffset) !== SHA256_EXTRA_ID
            || readU16(view, extraOffset + 2) !== SHA256_EXTRA_SIZE
        ) throw invalidContainer();
        const expectedDigest = bytes.slice(extraOffset + 4, extraOffset + 36);
        if (
            readU32(view, localOffset) !== ZIP_LOCAL_SIGNATURE
            || readU16(view, localOffset + 4) !== ZIP_VERSION_NEEDED
            || readU16(view, localOffset + 6) !== ZIP_UTF8_FLAG
            || readU16(view, localOffset + 8) !== ZIP_STORED_METHOD
            || readU16(view, localOffset + 10) !== ZIP_DOS_TIME
            || readU16(view, localOffset + 12) !== ZIP_DOS_DATE
            || readU32(view, localOffset + 14) !== crc
            || readU32(view, localOffset + 18) !== compressedSize
            || readU32(view, localOffset + 22) !== uncompressedSize
            || readU16(view, localOffset + 26) !== nameLength
            || readU16(view, localOffset + 28) !== 0
        ) throw invalidContainer();
        const localName = bytes.subarray(localOffset + 30, localOffset + 30 + nameLength);
        const centralName = bytes.subarray(offset + 46, offset + 46 + nameLength);
        if (!exactBytes(localName, centralName)) throw invalidContainer();
        const contentOffset = localOffset + 30 + nameLength;
        const contentEnd = contentOffset + uncompressedSize;
        if (contentEnd > centralOffset) throw invalidContainer();
        const content = bytes.slice(contentOffset, contentEnd);
        if (crc32(content) !== crc) throw hashMismatch();
        const digest = await sha256(content, crypto);
        if (!exactBytes(digest, expectedDigest)) throw hashMismatch();
        entries.push(Object.freeze({
            path,
            bytes: content,
            byteLength: content.byteLength,
            sha256: hex(digest),
            localOffset,
            contentEnd
        }));
        offset += 46 + nameLength + CENTRAL_EXTRA_SIZE;
    }
    if (offset !== endOffset) throw invalidContainer();
    for (let index = 0; index < entries.length; index += 1) {
        const expectedStart = index === 0 ? 0 : entries[index - 1].contentEnd;
        if (entries[index].localOffset !== expectedStart) throw invalidContainer();
    }
    if (entries.at(-1).contentEnd !== centralOffset) throw invalidContainer();
    return Object.freeze(entries);
}
