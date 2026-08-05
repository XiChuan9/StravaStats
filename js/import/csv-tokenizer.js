import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { deepFreeze } from './safe-data.js';

export const ACTIVITIES_CSV_LIMITS = deepFreeze({
    maxBytes: 5_242_880,
    maxRows: 10_000,
    maxColumns: 128,
    maxFieldBytes: 262_144,
    maxRowBytes: 1_048_576
});

const encoder = new TextEncoder();

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

function assertCharacters(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (
            code === 0
            || code === 0xfffd
            || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
            || (code >= 0xd800 && code <= 0xdbff && (
                index + 1 >= value.length
                || value.charCodeAt(index + 1) < 0xdc00
                || value.charCodeAt(index + 1) > 0xdfff
            ))
            || (code >= 0xdc00 && code <= 0xdfff && (
                index === 0
                || value.charCodeAt(index - 1) < 0xd800
                || value.charCodeAt(index - 1) > 0xdbff
            ))
        ) fail(IMPORT_ERROR_CODE.CSV_INVALID_CHARACTER);
        if (code >= 0xd800 && code <= 0xdbff) index += 1;
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

function finishField(row, value) {
    if (byteLength(value) > ACTIVITIES_CSV_LIMITS.maxFieldBytes) {
        fail(IMPORT_ERROR_CODE.CSV_FIELD_TOO_LARGE);
    }
    row.push(value);
    if (row.length > ACTIVITIES_CSV_LIMITS.maxColumns) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_MANY_COLUMNS);
    }
}

function blankRow(row, hasCsvStructure) {
    return !hasCsvStructure && row.length === 1 && row[0].length === 0;
}

function tokenizeActivitiesCsv(value) {
    if (typeof value !== 'string') fail(IMPORT_ERROR_CODE.CSV_INVALID_ENCODING);
    if (byteLength(value) > ACTIVITIES_CSV_LIMITS.maxBytes) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_LARGE);
    }
    assertCharacters(value);
    let text = value;
    const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
    if (bom) text = text.slice(1);
    if (text.length === 0) fail(IMPORT_ERROR_CODE.FILE_EMPTY);

    const records = [];
    const rawRecords = [];
    let row = [];
    let field = '';
    let quoted = false;
    let quoteClosed = false;
    let rowHasCsvStructure = false;
    let rowStart = 0;

    const finishRow = end => {
        finishField(row, field);
        if (byteLength(text.slice(rowStart, end)) > ACTIVITIES_CSV_LIMITS.maxRowBytes) {
            fail(IMPORT_ERROR_CODE.CSV_ROW_TOO_LARGE);
        }
        if (!blankRow(row, rowHasCsvStructure)) {
            records.push(row);
            rawRecords.push(text.slice(rowStart, end));
        }
        row = [];
        field = '';
        quoted = false;
        quoteClosed = false;
        rowHasCsvStructure = false;
    };

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    quoted = false;
                    quoteClosed = true;
                }
            } else if (character === '\r') {
                if (text[index + 1] !== '\n') {
                    fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
                }
                field += '\n';
                index += 1;
            } else {
                field += character;
            }
            continue;
        }

        if (quoteClosed) {
            if (character === ',') {
                finishField(row, field);
                field = '';
                quoteClosed = false;
                continue;
            }
            if (character === '\n' || (character === '\r' && text[index + 1] === '\n')) {
                if (character === '\r') index += 1;
                finishRow(index + 1);
                rowStart = index + 1;
                continue;
            }
            fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
        }

        if (character === '"') {
            if (field.length !== 0) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
            quoted = true;
            rowHasCsvStructure = true;
        } else if (character === ',') {
            finishField(row, field);
            field = '';
            rowHasCsvStructure = true;
        } else if (character === '\n') {
            finishRow(index + 1);
            rowStart = index + 1;
        } else if (character === '\r') {
            if (text[index + 1] !== '\n') fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
            index += 1;
            finishRow(index + 1);
            rowStart = index + 1;
        } else {
            field += character;
        }
    }
    if (quoted) fail(IMPORT_ERROR_CODE.CSV_MALFORMED);
    if (row.length > 0 || field.length > 0 || quoteClosed) finishRow(text.length);
    if (records.length === 0) fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    if (records[0].length > ACTIVITIES_CSV_LIMITS.maxColumns) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_MANY_COLUMNS);
    }
    if (records.length - 1 > ACTIVITIES_CSV_LIMITS.maxRows) {
        fail(IMPORT_ERROR_CODE.CSV_TOO_MANY_ROWS);
    }
    return { bom, records, rawRecords };
}

export function parseActivitiesCsv(value) {
    const { records } = tokenizeActivitiesCsv(value);
    return deepFreeze(records.map(record => [...record]));
}

export function frameActivitiesCsv(value) {
    const { bom, records, rawRecords } = tokenizeActivitiesCsv(value);
    if (records.length < 2) fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    return deepFreeze(rawRecords.slice(1).map(row => (
        `${bom}${rawRecords[0]}${row}`
    )));
}
