import { validateImportedActivityBundle } from '../data/contracts/index.js';
import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { frozenClone, ownDataValues } from './safe-data.js';

const INPUT_FIELDS = Object.freeze(['decoded', 'rawArtifactId']);

export function normalizeImportedActivity(input) {
    const values = ownDataValues(input, INPUT_FIELDS);
    if (
        !values
        || typeof values.rawArtifactId !== 'string'
        || values.rawArtifactId.length === 0
    ) {
        throw importError(IMPORT_ERROR_CODE.NORMALIZATION_FAILED, false, 'normalize');
    }
    let bundle;
    try {
        bundle = frozenClone(values.decoded);
        const mutable = structuredClone(bundle);
        mutable.sources = mutable.sources.map(source => ({
            ...source,
            rawArtifactId: values.rawArtifactId
        }));
        bundle = frozenClone(mutable);
        const validation = validateImportedActivityBundle(bundle);
        if (validation.ok !== true) throw new TypeError();
    } catch {
        throw importError(IMPORT_ERROR_CODE.NORMALIZATION_FAILED, false, 'normalize');
    }
    return bundle;
}
