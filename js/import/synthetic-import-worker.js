import { createDecoderRegistry } from './decoder-registry.js';
import { IMPORT_ERROR_CODE } from './errors.js';
import { ownDataValues } from './safe-data.js';
import { syntheticJsonDecoder } from './synthetic-json-decoder.js';

const registry = createDecoderRegistry([syntheticJsonDecoder]);
const INPUT_FIELDS = Object.freeze(['mediaType', 'content', 'rawArtifactId']);

export function processSyntheticImport(input) {
    try {
        const values = ownDataValues(input, INPUT_FIELDS);
        if (!values) throw new TypeError();
        const decoder = registry.select(values.mediaType);
        const decoded = decoder.decode({
            mediaType: values.mediaType,
            content: values.content
        });
        return Object.freeze({
            ok: true,
            decoded
        });
    } catch (error) {
        return Object.freeze({
            ok: false,
            code: typeof error?.code === 'string'
                ? error.code
                : IMPORT_ERROR_CODE.DECODER_FAILED,
            retryable: error?.retryable === true
        });
    }
}

if (
    typeof WorkerGlobalScope !== 'undefined'
    && typeof self === 'object'
    && self instanceof WorkerGlobalScope
) {
    self.onmessage = event => {
        const id = event?.data?.id;
        const result = processSyntheticImport(event?.data?.input);
        self.postMessage({ id, result });
    };
}
