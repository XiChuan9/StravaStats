import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CHART_PRESENTATION_TARGET,
    MAP_PRESENTATION_TARGET,
    STREAM_PRESENTATION_THRESHOLD,
    prepareStreamChartPresentation,
    prepareStreamMapPresentation,
    reduceAlignedStreamData,
    restoreStreamGapMask
} from '../../js/pages/detail/stream-presentation.js';

function values(length, read) {
    return Array.from({ length }, (_, index) => read(index));
}

test('presentation constants freeze the approved Stream threshold and caps', () => {
    assert.equal(STREAM_PRESENTATION_THRESHOLD, 2_000);
    assert.equal(CHART_PRESENTATION_TARGET, 1_000);
    assert.equal(MAP_PRESENTATION_TARGET, 2_000);
});

test('inputs at or below the threshold pass through unchanged and omit missing series', () => {
    const labels = values(STREAM_PRESENTATION_THRESHOLD, index => `offset-${Math.floor(index / 2)}`);
    const primary = values(STREAM_PRESENTATION_THRESHOLD, index => index);
    const result = reduceAlignedStreamData(
        { labels, primary, absent: undefined },
        { criticalKeys: ['primary', 'absent'], target: CHART_PRESENTATION_TARGET }
    );

    assert.equal(result.status, 'unchanged');
    assert.equal(result.indices, null);
    assert.equal(result.data.labels, labels);
    assert.equal(result.data.primary, primary);
    assert.equal(Object.hasOwn(result.data, 'absent'), false);
});

test('critical selection preserves alignment, anchors, gaps, extrema, zeros, order, and inputs', () => {
    const length = 2_017;
    const labels = values(length, index => `offset-${Math.floor(index / 3)}`);
    const primary = values(length, index => 100 + (index % 17));
    const secondary = values(length, index => 200 - (index % 13));
    primary[111] = -500;
    primary[1_901] = 900;
    primary[301] = 0;
    primary[302] = -0;
    primary[701] = null;
    primary[702] = null;
    secondary[77] = -700;
    secondary[1_777] = 1_200;
    secondary[1_201] = null;

    const primarySnapshot = primary.slice();
    const secondarySnapshot = secondary.slice();
    const result = reduceAlignedStreamData(
        { labels, primary, secondary, absent: null },
        { criticalKeys: ['primary', 'secondary', 'absent'], target: 80 }
    );

    assert.equal(result.status, 'reduced');
    assert.ok(result.indices.length <= 80);
    assert.equal(result.indices[0], 0);
    assert.equal(result.indices.at(-1), length - 1);
    assert.deepEqual(result.indices, [...result.indices].sort((a, b) => a - b));
    assert.equal(new Set(result.indices).size, result.indices.length);
    for (const index of [77, 111, 301, 302, 700, 701, 703, 1_200, 1_201, 1_202, 1_777, 1_901]) {
        assert.ok(result.indices.includes(index), `missing critical index ${index}`);
    }
    for (let outputIndex = 0; outputIndex < result.indices.length; outputIndex += 1) {
        const inputIndex = result.indices[outputIndex];
        assert.equal(result.data.labels[outputIndex], labels[inputIndex]);
        assert.ok(Object.is(result.data.primary[outputIndex], primary[inputIndex]));
        assert.ok(Object.is(result.data.secondary[outputIndex], secondary[inputIndex]));
    }
    assert.equal(Object.hasOwn(result.data, 'absent'), false);
    assert.deepEqual(primary, primarySnapshot);
    assert.deepEqual(secondary, secondarySnapshot);
});

test('bucket extrema use the deterministic first occurrence for every critical series', () => {
    const length = 2_001;
    const labels = values(length, index => index);
    const first = values(length, () => 5);
    const second = values(length, () => 9);
    const target = 20;
    first[100] = -10;
    first[1_900] = 20;
    second[200] = -20;
    second[1_800] = 30;
    const bucketCount = Math.floor((target - 6) / 4);
    const bucketStart = Math.floor(length / bucketCount) + 30;
    first[bucketStart] = 1;
    first[bucketStart + 1] = 1;
    first[bucketStart + 2] = 12;
    first[bucketStart + 3] = 12;
    second[bucketStart + 4] = 2;
    second[bucketStart + 5] = 2;
    second[bucketStart + 6] = 15;
    second[bucketStart + 7] = 15;

    const result = reduceAlignedStreamData(
        { labels, first, second },
        { criticalKeys: ['first', 'second'], target }
    );

    assert.equal(result.status, 'reduced');
    for (const index of [bucketStart, bucketStart + 2, bucketStart + 4, bucketStart + 6]) {
        assert.ok(result.indices.includes(index), `missing first-occurring bucket extremum ${index}`);
    }
    for (const index of [bucketStart + 1, bucketStart + 3, bucketStart + 5, bucketStart + 7]) {
        assert.equal(result.indices.includes(index), false, `selected duplicate extremum ${index}`);
    }
});

test('mandatory anchors beyond the cap return a stable bounded too-fragmented state', () => {
    const length = 3_001;
    const labels = values(length, index => index);
    const fragmented = values(length, index => index % 2 === 0 ? index : null);

    const first = reduceAlignedStreamData(
        { labels, fragmented },
        { criticalKeys: ['fragmented'], target: CHART_PRESENTATION_TARGET }
    );
    const second = reduceAlignedStreamData(
        { labels, fragmented },
        { criticalKeys: ['fragmented'], target: CHART_PRESENTATION_TARGET }
    );

    assert.equal(first.status, 'too-fragmented');
    assert.equal(first.reason, 'too fragmented to plot');
    assert.deepEqual(first.indices, []);
    assert.deepEqual(first.data, { labels: [], fragmented: [] });
    assert.deepEqual(second, first);
    assert.ok(first.data.labels.length <= CHART_PRESENTATION_TARGET);
});

test('Chart adapter aligns every displayed dataset and reapplied gap masks', () => {
    const length = 2_101;
    const labels = values(length, index => index);
    const raw = values(length, index => index + 1);
    raw[900] = null;
    raw[901] = null;
    const smoothed = values(length, index => index + 0.5);
    const restored = restoreStreamGapMask(smoothed, raw);
    const datasets = [
        { label: 'one', data: restored },
        { label: 'missing' },
        { label: 'two', data: values(length, index => length - index) }
    ];

    const result = prepareStreamChartPresentation(labels, datasets);

    assert.equal(result.status, 'reduced');
    assert.ok(result.labels.length <= CHART_PRESENTATION_TARGET);
    assert.equal(result.datasets[0].data.length, result.labels.length);
    assert.equal(result.datasets[2].data.length, result.labels.length);
    assert.equal(Object.hasOwn(result.datasets[1], 'data'), false);
    const gapOffset = result.indices.indexOf(900);
    assert.notEqual(gapOffset, -1);
    assert.equal(result.datasets[0].data[gapOffset], null);
    assert.notEqual(restored, smoothed);
    assert.equal(smoothed[900], 900.5);
});

test('Leaflet adapter retains abstract geometry alignment and obeys the map cap', () => {
    const length = 4_003;
    const coordinates = values(length, index => [index % 89, index % 179]);
    const routeValues = values(length, index => (index % 101) - 50);
    const snapshot = coordinates.map(point => point.slice());

    const result = prepareStreamMapPresentation(coordinates, routeValues);

    assert.equal(result.status, 'reduced');
    assert.ok(result.coordinates.length <= MAP_PRESENTATION_TARGET);
    assert.equal(result.routeValues.length, result.coordinates.length);
    assert.deepEqual(result.coordinates[0], coordinates[0]);
    assert.deepEqual(result.coordinates.at(-1), coordinates.at(-1));
    assert.deepEqual(coordinates, snapshot);
});

test('frozen-input selection reuse returns detached indices and projections', () => {
    const length = 3_001;
    const labels = Object.freeze(values(length, index => index));
    const primary = Object.freeze(values(length, index => index % 17));
    const input = Object.freeze({ labels, primary });
    const first = reduceAlignedStreamData(input, {
        criticalKeys: ['primary'],
        target: CHART_PRESENTATION_TARGET
    });
    first.indices.pop();
    first.data.primary[0] = 99_999;
    const second = reduceAlignedStreamData(input, {
        criticalKeys: ['primary'],
        target: CHART_PRESENTATION_TARGET
    });
    assert.equal(second.indices[0], 0);
    assert.equal(second.indices.at(-1), length - 1);
    assert.equal(second.data.primary[0], primary[0]);
});
