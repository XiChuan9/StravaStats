export const STREAM_PRESENTATION_THRESHOLD = 2_000;
export const CHART_PRESENTATION_TARGET = 1_000;
export const MAP_PRESENTATION_TARGET = 2_000;

const TOO_FRAGMENTED_REASON = 'too fragmented to plot';
const FROZEN_SELECTION_CACHE = new WeakMap();

function normalizedArrays(data) {
    const arrays = {};
    if (!data || typeof data !== 'object') return arrays;
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) arrays[key] = value;
    }
    return arrays;
}

function alignedLength(arrays) {
    let length = 0;
    for (const value of Object.values(arrays)) length = Math.max(length, value.length);
    return length;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function tooFragmented(data) {
    return {
        status: 'too-fragmented',
        reason: TOO_FRAGMENTED_REASON,
        indices: [],
        data: Object.fromEntries(Object.keys(data).map(key => [key, []]))
    };
}

function collectMandatoryIndices(series, length, target) {
    const indices = new Set();
    if (length > 0) indices.add(0);
    if (length > 1) indices.add(length - 1);

    let positiveZeroIndex = -1;
    let negativeZeroIndex = -1;

    for (const values of series) {
        const limit = Math.min(length, values.length);
        let minimum = Infinity;
        let maximum = -Infinity;
        let minimumIndex = -1;
        let maximumIndex = -1;

        for (let index = 0; index < limit; index += 1) {
            const value = values[index];
            if (value === null) {
                const runStart = index;
                while (index + 1 < limit && values[index + 1] === null) index += 1;
                indices.add(runStart);
                if (runStart > 0 && isFiniteNumber(values[runStart - 1])) indices.add(runStart - 1);
                if (index + 1 < limit && isFiniteNumber(values[index + 1])) indices.add(index + 1);
                if (indices.size > target) return null;
                continue;
            }
            if (!isFiniteNumber(value)) continue;

            if (value < minimum) {
                minimum = value;
                minimumIndex = index;
            }
            if (value > maximum) {
                maximum = value;
                maximumIndex = index;
            }
            if (value === 0) {
                if (Object.is(value, -0)) {
                    if (negativeZeroIndex < 0) negativeZeroIndex = index;
                } else if (positiveZeroIndex < 0) {
                    positiveZeroIndex = index;
                }
            }
        }

        if (minimumIndex >= 0) indices.add(minimumIndex);
        if (maximumIndex >= 0) indices.add(maximumIndex);
        if (indices.size > target) return null;
    }

    if (positiveZeroIndex >= 0) indices.add(positiveZeroIndex);
    if (negativeZeroIndex >= 0) indices.add(negativeZeroIndex);
    return indices.size > target ? null : indices;
}

function addBucketExtrema(indices, series, length, bucketCount) {
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
        const start = Math.floor((bucket * length) / bucketCount);
        const end = Math.floor(((bucket + 1) * length) / bucketCount);
        for (const values of series) {
            const limit = Math.min(end, values.length);
            let minimum = Infinity;
            let maximum = -Infinity;
            let minimumIndex = -1;
            let maximumIndex = -1;
            for (let index = start; index < limit; index += 1) {
                const value = values[index];
                if (!isFiniteNumber(value)) continue;
                if (value < minimum) {
                    minimum = value;
                    minimumIndex = index;
                }
                if (value > maximum) {
                    maximum = value;
                    maximumIndex = index;
                }
            }
            if (minimumIndex >= 0) indices.add(minimumIndex);
            if (maximumIndex >= 0) indices.add(maximumIndex);
        }
    }
}

function collectMandatoryAndBucketIndices(series, length, target, bucketCount) {
    const mandatory = new Set();
    const bucketExtrema = new Set();
    if (length > 0) mandatory.add(0);
    if (length > 1) mandatory.add(length - 1);
    let positiveZeroIndex = -1;
    let negativeZeroIndex = -1;

    for (const values of series) {
        const limit = Math.min(length, values.length);
        let globalMinimum = Infinity;
        let globalMaximum = -Infinity;
        let globalMinimumIndex = -1;
        let globalMaximumIndex = -1;
        let inNullRun = false;

        for (let bucket = 0; bucket < bucketCount; bucket += 1) {
            const start = Math.floor((bucket * length) / bucketCount);
            const end = Math.min(
                Math.floor(((bucket + 1) * length) / bucketCount),
                limit
            );
            let bucketMinimum = Infinity;
            let bucketMaximum = -Infinity;
            let bucketMinimumIndex = -1;
            let bucketMaximumIndex = -1;
            for (let index = start; index < end; index += 1) {
                const value = values[index];
                if (value === null) {
                    if (!inNullRun) {
                        mandatory.add(index);
                        if (index > 0 && isFiniteNumber(values[index - 1])) {
                            mandatory.add(index - 1);
                        }
                        if (mandatory.size > target) return null;
                    }
                    inNullRun = true;
                    continue;
                }
                if (inNullRun && isFiniteNumber(value)) {
                    mandatory.add(index);
                    if (mandatory.size > target) return null;
                }
                inNullRun = false;
                if (!isFiniteNumber(value)) continue;
                if (value < bucketMinimum) {
                    bucketMinimum = value;
                    bucketMinimumIndex = index;
                }
                if (value > bucketMaximum) {
                    bucketMaximum = value;
                    bucketMaximumIndex = index;
                }
                if (value === 0) {
                    if (Object.is(value, -0)) {
                        if (negativeZeroIndex < 0) negativeZeroIndex = index;
                    } else if (positiveZeroIndex < 0) {
                        positiveZeroIndex = index;
                    }
                }
            }
            if (bucketMinimumIndex >= 0) {
                bucketExtrema.add(bucketMinimumIndex);
                if (bucketMinimum < globalMinimum) {
                    globalMinimum = bucketMinimum;
                    globalMinimumIndex = bucketMinimumIndex;
                }
            }
            if (bucketMaximumIndex >= 0) {
                bucketExtrema.add(bucketMaximumIndex);
                if (bucketMaximum > globalMaximum) {
                    globalMaximum = bucketMaximum;
                    globalMaximumIndex = bucketMaximumIndex;
                }
            }
        }
        if (globalMinimumIndex >= 0) mandatory.add(globalMinimumIndex);
        if (globalMaximumIndex >= 0) mandatory.add(globalMaximumIndex);
        if (mandatory.size > target) return null;
    }
    if (positiveZeroIndex >= 0) mandatory.add(positiveZeroIndex);
    if (negativeZeroIndex >= 0) mandatory.add(negativeZeroIndex);
    return mandatory.size > target ? null : { mandatory, bucketExtrema };
}

function addUniformIndices(indices, length, target) {
    const remaining = target - indices.size;
    if (remaining <= 0) return;
    for (let slot = 1; slot <= remaining; slot += 1) {
        indices.add(Math.floor((slot * (length - 1)) / (remaining + 1)));
    }
}

function selectCriticalIndices(series, length, { target, threshold }) {
    if (length <= threshold) return { status: 'unchanged', indices: null };

    if (series.length > 0 && target >= 256) {
        const reservedAnchors = Math.max(16, Math.ceil(target / 5));
        const provisionalBucketCount = Math.max(
            1,
            Math.floor((target - reservedAnchors) / (2 * series.length))
        );
        const collected = collectMandatoryAndBucketIndices(
            series,
            length,
            target,
            provisionalBucketCount
        );
        if (!collected) return { status: 'too-fragmented', indices: [] };
        const selected = new Set([
            ...collected.mandatory,
            ...collected.bucketExtrema
        ]);
        if (selected.size <= target) {
            return {
                status: 'reduced',
                indices: [...selected].sort((left, right) => left - right)
            };
        }
        const remaining = target - collected.mandatory.size;
        const bucketCount = Math.floor(remaining / (2 * series.length));
        if (bucketCount > 0) {
            addBucketExtrema(collected.mandatory, series, length, bucketCount);
        }
        return {
            status: 'reduced',
            indices: [...collected.mandatory].sort((left, right) => left - right)
        };
    }

    const mandatory = collectMandatoryIndices(series, length, target);
    if (!mandatory) return { status: 'too-fragmented', indices: [] };

    if (series.length === 0) {
        addUniformIndices(mandatory, length, target);
    } else {
        const remaining = target - mandatory.size;
        const bucketCount = Math.floor(remaining / (2 * series.length));
        if (bucketCount > 0) addBucketExtrema(mandatory, series, length, bucketCount);
    }

    const indices = [...mandatory].sort((left, right) => left - right);
    return { status: 'reduced', indices };
}

function cachedSelection(data, series, length, target, threshold) {
    try {
        if (
            data === null
            || typeof data !== 'object'
            || !Object.isFrozen(data)
            || !series.every(values => Object.isFrozen(values))
        ) return null;
        const entries = FROZEN_SELECTION_CACHE.get(data) ?? [];
        const entry = entries.find(candidate => (
            candidate.length === length
            && candidate.target === target
            && candidate.threshold === threshold
            && candidate.series.length === series.length
            && candidate.series.every((values, index) => values === series[index])
        ));
        if (!entry) return null;
        return {
            status: entry.status,
            indices: entry.indices === null ? null : [...entry.indices]
        };
    } catch {
        return null;
    }
}

function cacheSelection(data, series, length, target, threshold, selection) {
    try {
        if (
            data === null
            || typeof data !== 'object'
            || !Object.isFrozen(data)
            || !series.every(values => Object.isFrozen(values))
        ) return;
        const entries = FROZEN_SELECTION_CACHE.get(data) ?? [];
        entries.push(Object.freeze({
            length,
            target,
            threshold,
            series: Object.freeze([...series]),
            status: selection.status,
            indices: selection.indices === null
                ? null
                : Object.freeze([...selection.indices])
        }));
        FROZEN_SELECTION_CACHE.set(data, entries.slice(-8));
    } catch {
        // Caching is optional; selection remains deterministic without it.
    }
}

/**
 * Selects one ordered index set for every aligned display array. Only array-valued
 * entries participate in the result, so an absent Stream remains absent.
 */
export function reduceAlignedStreamData(data, {
    criticalKeys,
    target = CHART_PRESENTATION_TARGET,
    threshold = STREAM_PRESENTATION_THRESHOLD
} = {}) {
    if (!Number.isInteger(target) || target < 2) throw new TypeError('target must be an integer of at least 2');
    if (!Number.isInteger(threshold) || threshold < 0) throw new TypeError('threshold must be a non-negative integer');

    const arrays = normalizedArrays(data);
    const length = alignedLength(arrays);
    const keys = Array.isArray(criticalKeys) ? criticalKeys : Object.keys(arrays);
    const series = keys.map(key => arrays[key]).filter(Array.isArray);
    let selection = cachedSelection(data, series, length, target, threshold);
    if (selection === null) {
        selection = selectCriticalIndices(series, length, { target, threshold });
        cacheSelection(data, series, length, target, threshold, selection);
    }

    if (selection.status === 'unchanged') {
        return { status: 'unchanged', reason: null, indices: null, data: arrays };
    }
    if (selection.status === 'too-fragmented') return tooFragmented(arrays);

    const projected = {};
    for (const [key, values] of Object.entries(arrays)) {
        projected[key] = selection.indices.map(index => values[index]);
    }
    return { status: 'reduced', reason: null, indices: selection.indices, data: projected };
}

/** Restores exact null positions erased by a smoothing pass without mutating either input. */
export function restoreStreamGapMask(smoothed, original) {
    if (!Array.isArray(smoothed) || !Array.isArray(original)) return smoothed;
    const limit = Math.min(smoothed.length, original.length);
    let restored = null;
    for (let index = 0; index < limit; index += 1) {
        if (original[index] !== null || smoothed[index] === null) continue;
        if (!restored) restored = smoothed.slice();
        restored[index] = null;
    }
    return restored || smoothed;
}

/** Applies aligned reduction to Chart labels and only the datasets that contain arrays. */
export function prepareStreamChartPresentation(labels, datasets, options = {}) {
    const aligned = { labels };
    const criticalKeys = [];
    datasets.forEach((dataset, index) => {
        if (!Array.isArray(dataset?.data)) return;
        const key = `series${index}`;
        aligned[key] = dataset.data;
        criticalKeys.push(key);
    });
    const result = reduceAlignedStreamData(aligned, {
        ...options,
        criticalKeys,
        target: options.target ?? CHART_PRESENTATION_TARGET
    });
    return {
        status: result.status,
        reason: result.reason,
        indices: result.indices,
        labels: result.data.labels || [],
        datasets: datasets.map((dataset, index) => {
            const key = `series${index}`;
            return Object.hasOwn(result.data, key)
                ? { ...dataset, data: result.data[key] }
                : dataset;
        })
    };
}

/** Applies one aligned selection to Leaflet coordinates and an optional color series. */
export function prepareStreamMapPresentation(coordinates, routeValues, options = {}) {
    const safeCoordinates = Array.isArray(coordinates) ? coordinates : [];
    const latitude = safeCoordinates.map(point => point?.[0]);
    const longitude = safeCoordinates.map(point => point?.[1]);
    const aligned = { coordinates: safeCoordinates, latitude, longitude };
    const criticalKeys = ['latitude', 'longitude'];
    if (Array.isArray(routeValues)) {
        aligned.routeValues = routeValues;
        criticalKeys.push('routeValues');
    }
    const result = reduceAlignedStreamData(aligned, {
        ...options,
        criticalKeys,
        target: options.target ?? MAP_PRESENTATION_TARGET
    });
    return {
        status: result.status,
        reason: result.reason,
        indices: result.indices,
        coordinates: result.data.coordinates || [],
        ...(Array.isArray(routeValues) ? { routeValues: result.data.routeValues || [] } : {})
    };
}
