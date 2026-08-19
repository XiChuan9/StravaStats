export const CSV_FILE_LIMITS = Object.freeze({
    maxBytes: 5_242_880,
    maxRows: 10_000
});

const encoder = new TextEncoder();

function csvLimitError(code, message) {
    const error = new RangeError(message);
    error.code = code;
    return error;
}

export function spreadsheetTextCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    let firstMeaningful = 0;
    while (firstMeaningful < text.length) {
        const character = String.fromCodePoint(text.codePointAt(firstMeaningful));
        if (/[\p{Cc}\p{Cf}]/u.test(character)) return `'${text}`;
        if (!/\s/u.test(character)) break;
        firstMeaningful += character.length;
    }
    return firstMeaningful < text.length
        && '=+-@'.includes(text[firstMeaningful])
        ? `'${text}`
        : text;
}

export function serializeCsvCell(value, alwaysQuote = false) {
    if (typeof alwaysQuote !== 'boolean') throw new TypeError('CSV mode is invalid.');
    const text = spreadsheetTextCell(value);
    return alwaysQuote || /[,"\r\n]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
}

export function boundedCsvLines(value) {
    if (typeof value !== 'string') throw new TypeError('CSV input is invalid.');

    if (encoder.encode(value).byteLength > CSV_FILE_LIMITS.maxBytes) {
        throw csvLimitError('CSV_TOO_LARGE', 'CSV file exceeds the 5 MiB limit.');
    }

    const lines = [];
    let start = value.startsWith('\uFEFF') ? 1 : 0;
    for (let index = start; index <= value.length; index += 1) {
        if (index !== value.length && value[index] !== '\n') continue;
        let end = index;
        if (end > start && value[end - 1] === '\r') end -= 1;
        const line = value.slice(start, end).trim();
        if (line.length > 0) {
            lines.push(line);
            if (lines.length > CSV_FILE_LIMITS.maxRows + 1) {
                throw csvLimitError(
                    'CSV_TOO_MANY_ROWS',
                    'CSV file exceeds the 10,000-row limit.'
                );
            }
        }
        start = index + 1;
    }
    return Object.freeze(lines);
}
