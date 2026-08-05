import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { findDataMethod, ownDataValues } from './safe-data.js';

const DECODER_FIELDS = Object.freeze(['id', 'mediaType', 'decode']);

export function createDecoderRegistry(decoders) {
    let snapshot;
    try {
        if (!Array.isArray(decoders) || decoders.length === 0) throw new TypeError();
        snapshot = decoders.map(decoder => {
            const values = ownDataValues(decoder, DECODER_FIELDS);
            const decode = values && findDataMethod(values, 'decode');
            if (
                !values
                || typeof values.id !== 'string'
                || values.id.length === 0
                || typeof values.mediaType !== 'string'
                || values.mediaType.length === 0
                || !decode
            ) throw new TypeError();
            return Object.freeze({
                id: values.id,
                mediaType: values.mediaType,
                decode: input => decode.call(decoder, input)
            });
        });
    } catch {
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    const byMediaType = new Map(snapshot.map(decoder => [decoder.mediaType, decoder]));
    if (byMediaType.size !== snapshot.length) {
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    return Object.freeze({
        select(mediaType) {
            if (typeof mediaType !== 'string') {
                throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
            }
            const decoder = byMediaType.get(mediaType);
            if (!decoder) throw importError(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT);
            return decoder;
        }
    });
}
