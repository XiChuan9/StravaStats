import {
    ACTIVITIES_CSV_MEDIA_TYPE,
    activitiesCsvDecoder
} from './activities-csv-decoder.js';
import { decodeActivitiesCsvUtf8, frameActivitiesCsv, parseActivitiesCsv } from './csv-tokenizer.js';
import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { frozenClone, ownDataValues } from './safe-data.js';
import { STRAVA_ZIP_LIMITS, openStravaZipArchive } from './zip-inspector.js';

export const STRAVA_ZIP_MEDIA_TYPE = 'application/zip;profile=strava-archive;base64';
export const STRAVA_ARCHIVE_ROW_MEDIA_TYPE =
    'application/vnd.stravastats.strava-archive-row+json';

const WRAPPER_FIELDS = Object.freeze(['schemaVersion', 'csv', 'association', 'warningCode']);
const ASSOCIATION_FIELDS = Object.freeze([
    'format', 'byteLength', 'crc32', 'contentBase64'
]);
const ASSOCIATION_FORMATS = Object.freeze([
    'fit', 'tcx', 'gpx', 'fit.gz', 'tcx.gz', 'gpx.gz'
]);
const WARNING_CODES = Object.freeze([
    'ZIP_ACTIVITY_FILENAME_MISSING',
    'ZIP_ACTIVITY_FILENAME_INVALID',
    'ZIP_ACTIVITY_FILE_NOT_FOUND',
    'ZIP_ACTIVITY_FILE_DUPLICATE',
    'ZIP_ACTIVITY_FILE_AMBIGUOUS',
    'ZIP_ACTIVITY_FILE_UNSUPPORTED'
]);
const WARNING_MESSAGES = Object.freeze({
    ZIP_ACTIVITY_FILENAME_MISSING: 'The archive CSV does not provide an activity-file reference.',
    ZIP_ACTIVITY_FILENAME_INVALID: 'The archive CSV activity-file reference is invalid.',
    ZIP_ACTIVITY_FILE_NOT_FOUND: 'The referenced archive activity file is unavailable.',
    ZIP_ACTIVITY_FILE_DUPLICATE: 'The archive activity file is referenced more than once.',
    ZIP_ACTIVITY_FILE_AMBIGUOUS: 'The archive activity-file reference is ambiguous.',
    ZIP_ACTIVITY_FILE_UNSUPPORTED: 'The associated activity file is preserved but not decoded.'
});

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

function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.byteLength; offset += 32_768) {
        binary += String.fromCharCode(...bytes.subarray(
            offset,
            Math.min(bytes.byteLength, offset + 32_768)
        ));
    }
    return btoa(binary);
}

function strictBase64Bytes(value) {
    if (
        typeof value !== 'string'
        || value.length === 0
        || value.length % 4 !== 0
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    ) return null;
    try {
        const decoded = atob(value);
        if (btoa(decoded) !== value) return null;
        const bytes = new Uint8Array(decoded.length);
        for (let index = 0; index < decoded.length; index += 1) {
            bytes[index] = decoded.charCodeAt(index);
        }
        return bytes;
    } catch {
        return null;
    }
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function associationFormat(name) {
    const folded = name.toLowerCase();
    return ASSOCIATION_FORMATS.find(format => folded.endsWith(`.${format}`)) || null;
}

function validAssociationPath(value) {
    if (
        typeof value !== 'string'
        || value.length === 0
        || value.trim() !== value
        || value.normalize('NFC') !== value
        || new TextEncoder().encode(value).byteLength > STRAVA_ZIP_LIMITS.maxFilenameBytes
        || value.includes('\0')
        || value.includes('\\')
        || value.startsWith('/')
        || value.startsWith('//')
        || /^[A-Za-z]:/.test(value)
        || value.endsWith('/')
    ) return false;
    const segments = value.split('/');
    return segments.length <= STRAVA_ZIP_LIMITS.maxDirectoryDepth
        && segments.every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

function readAssociationRows(records, entries) {
    const [header, ...rows] = records;
    const positions = [];
    for (let index = 0; index < header.length; index += 1) {
        if (header[index] === 'Activity Filename') positions.push(index);
    }
    if (positions.length > 1) fail(IMPORT_ERROR_CODE.CSV_HEADER_INVALID);
    const exact = new Map(entries.filter(entry => !entry.directory).map(entry => [entry.name, entry]));
    const folded = new Map();
    for (const entry of entries.filter(candidate => !candidate.directory)) {
        const key = entry.name.toLowerCase();
        const matches = folded.get(key) || [];
        matches.push(entry);
        folded.set(key, matches);
    }
    const resolved = rows.map(row => {
        if (positions.length === 0) {
            return { entry: null, format: null, warningCode: 'ZIP_ACTIVITY_FILENAME_MISSING' };
        }
        const value = row[positions[0]];
        if (!validAssociationPath(value)) {
            return { entry: null, format: null, warningCode: 'ZIP_ACTIVITY_FILENAME_INVALID' };
        }
        const entry = exact.get(value);
        if (!entry) {
            return {
                entry: null,
                format: null,
                warningCode: folded.has(value.toLowerCase())
                    ? 'ZIP_ACTIVITY_FILE_AMBIGUOUS'
                    : 'ZIP_ACTIVITY_FILE_NOT_FOUND'
            };
        }
        const format = associationFormat(entry.name);
        return format
            && entry.uncompressedSize > 0
            ? { entry, format, warningCode: 'ZIP_ACTIVITY_FILE_UNSUPPORTED' }
            : { entry: null, format: null, warningCode: 'ZIP_ACTIVITY_FILE_UNSUPPORTED' };
    });
    const referenceCounts = new Map();
    for (const item of resolved) {
        if (item.entry) {
            referenceCounts.set(item.entry, (referenceCounts.get(item.entry) || 0) + 1);
        }
    }
    return resolved.map(item => (
        item.entry && referenceCounts.get(item.entry) > 1
            ? { entry: null, format: null, warningCode: 'ZIP_ACTIVITY_FILE_DUPLICATE' }
            : item
    ));
}

function parseWrapper(content) {
    if (typeof content !== 'string' || content.length === 0) {
        fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        fail(IMPORT_ERROR_CODE.FILE_CORRUPTED);
    }
    const values = ownDataValues(parsed, WRAPPER_FIELDS);
    if (
        !values
        || values.schemaVersion !== 1
        || typeof values.csv !== 'string'
        || values.csv.length === 0
        || (values.warningCode !== null && !WARNING_CODES.includes(values.warningCode))
    ) fail(IMPORT_ERROR_CODE.FILE_CORRUPTED);
    if (values.association !== null) {
        const association = ownDataValues(values.association, ASSOCIATION_FIELDS);
        const decodedBytes = association
            ? strictBase64Bytes(association.contentBase64)
            : null;
        if (
            !association
            || !ASSOCIATION_FORMATS.includes(association.format)
            || !Number.isSafeInteger(association.byteLength)
            || association.byteLength <= 0
            || association.byteLength > STRAVA_ZIP_LIMITS.maxUncompressedEntryBytes
            || decodedBytes?.byteLength !== association.byteLength
            || typeof association.crc32 !== 'string'
            || !/^[a-f0-9]{8}$/.test(association.crc32)
            || crc32(decodedBytes).toString(16).padStart(8, '0') !== association.crc32
            || values.warningCode !== 'ZIP_ACTIVITY_FILE_UNSUPPORTED'
        ) fail(IMPORT_ERROR_CODE.FILE_CORRUPTED);
    }
    return values;
}

export const stravaArchiveRowDecoder = Object.freeze({
    id: 'strava-archive-row:english-v1',
    mediaType: STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
    decode(input) {
        const values = ownDataValues(input, ['mediaType', 'content']);
        if (!values || values.mediaType !== STRAVA_ARCHIVE_ROW_MEDIA_TYPE) {
            fail(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT);
        }
        const wrapper = parseWrapper(values.content);
        const decoded = activitiesCsvDecoder.decode({
            mediaType: ACTIVITIES_CSV_MEDIA_TYPE,
            content: wrapper.csv
        });
        if (wrapper.warningCode === null) return decoded;
        return frozenClone({
            ...decoded,
            warnings: [
                ...decoded.warnings,
                {
                    code: wrapper.warningCode,
                    path: '/sources/0/rawArtifactId',
                    message: WARNING_MESSAGES[wrapper.warningCode]
                }
            ]
        });
    }
});

export async function expandStravaZipArtifact(content, isCancelled = () => false) {
    const archive = openStravaZipArchive(content, isCancelled);
    const manifest = archive.entries.find(entry => entry.name === 'activities.csv');
    if (!manifest) fail(IMPORT_ERROR_CODE.ZIP_ACTIVITIES_CSV_MISSING);
    const manifestBytes = await archive.extract(manifest);
    const csv = decodeActivitiesCsvUtf8(manifestBytes);
    const records = parseActivitiesCsv(csv);
    if (records.length < 2) fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    const framedRows = frameActivitiesCsv(csv);
    const associations = readAssociationRows(records, archive.entries);
    if (framedRows.length !== associations.length) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);

    const retained = new Map();
    const referencedEntries = new Set(
        associations.flatMap(association => association.entry ? [association.entry] : [])
    );
    for (const entry of archive.entries) {
        if (entry.directory || entry === manifest) continue;
        const bytes = await archive.extract(entry);
        if (referencedEntries.has(entry)) {
            retained.set(entry, bytes);
        }
    }

    return Object.freeze(framedRows.map((row, index) => {
        const association = associations[index];
        const child = association.entry
            ? (() => {
                const bytes = retained.get(association.entry);
                if (!bytes) fail(IMPORT_ERROR_CODE.ZIP_INVALID);
                return {
                    format: association.format,
                    byteLength: bytes.byteLength,
                    crc32: association.entry.crc32.toString(16).padStart(8, '0'),
                    contentBase64: bytesToBase64(bytes)
                };
            })()
            : null;
        return frozenClone({
            mediaType: STRAVA_ARCHIVE_ROW_MEDIA_TYPE,
            content: JSON.stringify({
                schemaVersion: 1,
                csv: row,
                association: child,
                warningCode: association.warningCode
            })
        });
    }));
}
