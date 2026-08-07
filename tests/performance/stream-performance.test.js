import assert from 'node:assert/strict';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
    CHART_PRESENTATION_TARGET,
    reduceAlignedStreamData
} from '../../js/pages/detail/stream-presentation.js';

const POINT_COUNT = 200_000;
const WARMUPS = 10;
const SAMPLES = 30;

function percentile95(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function makeDataset() {
    const offset = new Array(POINT_COUNT);
    const first = new Array(POINT_COUNT);
    const second = new Array(POINT_COUNT);
    const third = new Array(POINT_COUNT);
    const fourth = new Array(POINT_COUNT);
    const fifth = new Array(POINT_COUNT);
    for (let index = 0; index < POINT_COUNT; index += 1) {
        offset[index] = Math.floor(index / 2);
        first[index] = (index % 997) - 498;
        second[index] = ((index * 17) % 1_009) - 504;
        third[index] = Math.sin(index / 31) * 300;
        fourth[index] = Math.cos(index / 47) * 200;
        fifth[index] = ((index * 29) % 983) - 491;
    }
    first[31] = 0;
    first[32] = -0;
    third[90_000] = null;
    third[90_001] = null;
    return Object.freeze({
        offset: Object.freeze(offset),
        first: Object.freeze(first),
        second: Object.freeze(second),
        third: Object.freeze(third),
        fourth: Object.freeze(fourth),
        fifth: Object.freeze(fifth)
    });
}

test('200k aligned Stream reduction meets the deterministic Node latency gate', t => {
    const dataset = makeDataset();
    const options = Object.freeze({
        criticalKeys: Object.freeze(['offset', 'first', 'second', 'third', 'fourth', 'fifth']),
        target: CHART_PRESENTATION_TARGET
    });

    const coldStarted = performance.now();
    const coldResult = reduceAlignedStreamData(dataset, options);
    const coldMilliseconds = performance.now() - coldStarted;

    for (let index = 0; index < WARMUPS; index += 1) {
        reduceAlignedStreamData(dataset, options);
    }

    const samples = [];
    let lastResult;
    for (let index = 0; index < SAMPLES; index += 1) {
        const started = performance.now();
        lastResult = reduceAlignedStreamData(dataset, options);
        samples.push(performance.now() - started);
    }

    const p95 = percentile95(samples);
    const maximum = Math.max(...samples);
    const sortedSamples = [...samples].sort((left, right) => left - right);
    const median = sortedSamples[Math.floor(sortedSamples.length / 2)];
    assert.equal(coldResult.status, 'reduced');
    assert.equal(lastResult.status, 'reduced');
    assert.ok(lastResult.indices.length <= CHART_PRESENTATION_TARGET);
    assert.equal(lastResult.indices[0], 0);
    assert.equal(lastResult.indices.at(-1), POINT_COUNT - 1);
    assert.ok(lastResult.indices.some(index => Object.is(dataset.offset[index], 0)));
    assert.ok(lastResult.indices.includes(32));
    assert.ok(lastResult.indices.includes(89_999));
    assert.ok(lastResult.indices.includes(90_000));
    assert.ok(lastResult.indices.includes(90_002));
    assert.ok(p95 <= 25, `p95 ${p95.toFixed(3)} ms exceeded 25 ms`);
    assert.ok(maximum <= 50, `maximum ${maximum.toFixed(3)} ms exceeded 50 ms`);
    t.diagnostic(JSON.stringify({
        runtime: process.version,
        platform: `${process.platform}-${process.arch}`,
        hardware: cpus()[0]?.model || 'unavailable',
        dataset: { points: POINT_COUNT, alignedSeries: 6, target: CHART_PRESENTATION_TARGET },
        coldMilliseconds: +coldMilliseconds.toFixed(3),
        warmups: WARMUPS,
        samples: SAMPLES,
        medianMs: +median.toFixed(3),
        p95Ms: +p95.toFixed(3),
        maximumMs: +maximum.toFixed(3)
    }));
});
