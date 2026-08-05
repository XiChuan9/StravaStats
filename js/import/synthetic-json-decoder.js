import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { frozenClone, ownDataValues } from './safe-data.js';

export const SYNTHETIC_JSON_MEDIA_TYPE =
    'application/vnd.stravastats.synthetic+json';

const INPUT_FIELDS = Object.freeze(['mediaType', 'content']);

export const syntheticJsonDecoder = Object.freeze({
    id: 'synthetic-json',
    mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
    decode(input) {
        const values = ownDataValues(input, INPUT_FIELDS);
        if (!values || values.mediaType !== SYNTHETIC_JSON_MEDIA_TYPE) {
            throw importError(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT, false, 'decode');
        }
        if (typeof values.content !== 'string' || values.content.length === 0) {
            throw importError(IMPORT_ERROR_CODE.FILE_EMPTY, false, 'decode');
        }
        let parsed;
        try {
            parsed = JSON.parse(values.content);
            return frozenClone(parsed);
        } catch {
            throw importError(IMPORT_ERROR_CODE.FILE_CORRUPTED, false, 'decode');
        }
    }
});
