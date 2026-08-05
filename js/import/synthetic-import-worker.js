import { createDecoderRegistry } from './decoder-registry.js';
import { IMPORT_ERROR_CODE } from './errors.js';
import { ownDataValues } from './safe-data.js';
import { syntheticJsonDecoder } from './synthetic-json-decoder.js';
import { activitiesCsvDecoder } from './activities-csv-decoder.js';
import { stravaArchiveRowDecoder } from './strava-zip.js';
import { fitDecoder } from '../decoders/fit/decoder.js';
import { tcxDecoder } from '../decoders/tcx/decoder.js';
import { gpxDecoder } from '../decoders/gpx/decoder.js';

const registry = createDecoderRegistry([
    syntheticJsonDecoder,
    activitiesCsvDecoder,
    stravaArchiveRowDecoder,
    fitDecoder,
    tcxDecoder,
    gpxDecoder
]);
const INPUT_FIELDS = Object.freeze(['mediaType', 'content', 'rawArtifactId']);

function ownErrorValue(error, field) {
    try {
        if (error === null || (typeof error !== 'object' && typeof error !== 'function')) {
            return undefined;
        }
        const descriptor = Object.getOwnPropertyDescriptor(error, field);
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

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
        const code = ownErrorValue(error, 'code');
        return Object.freeze({
            ok: false,
            code: typeof code === 'string'
                ? code
                : IMPORT_ERROR_CODE.DECODER_FAILED,
            retryable: ownErrorValue(error, 'retryable') === true
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
