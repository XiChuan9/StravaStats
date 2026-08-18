import assert from 'node:assert/strict';
import test from 'node:test';

import {
    calculateHeartRateZoneSeconds,
    formatHeartRateZoneLabels,
    readHeartRateZones
} from '../../js/pages/detail/heart-rate-zone-presentation.js';

const zonesEnvelope = () => ({
    heart_rate: {
        custom_zones: true,
        zones: [
            { min: 1, max: 114 },
            { min: 114, max: 133 },
            { min: 133, max: 152 },
            { min: 152, max: 171 },
            { min: 171, max: -1 }
        ]
    }
});

test('reads all five continuous zones including an open Z5', () => {
    const zones = readHeartRateZones(zonesEnvelope());
    assert.equal(zones.length, 5);
    assert.deepEqual(zones[4], { min: 171, max: -1 });
    assert.ok(Object.isFrozen(zones));
    assert.ok(zones.every(Object.isFrozen));
});

test('formats local exclusive bounds without an off-by-one label', () => {
    const labels = formatHeartRateZoneLabels(
        readHeartRateZones(zonesEnvelope()),
        true
    );
    assert.deepEqual(labels, [
        'Z1 (<114)',
        'Z2 (114–132)',
        'Z3 (133–151)',
        'Z4 (152–170)',
        'Z5 (≥171)'
    ]);
});

test('calculates elapsed seconds with null gaps and open Z5 coverage', () => {
    const totals = calculateHeartRateZoneSeconds(
        { data: [100, 120, null, 150, 180] },
        { data: [0, 10, 20, 30, 45] },
        readHeartRateZones(zonesEnvelope())
    );
    assert.deepEqual(totals, [0, 10, 10, 0, 15]);
});

test('malformed, accessor, sparse, overlapping, and non-finite inputs fail closed', () => {
    const accessor = { heart_rate: {} };
    Object.defineProperty(accessor.heart_rate, 'zones', {
        enumerable: true,
        get() { throw new Error('must not execute'); }
    });
    const sparse = zonesEnvelope();
    delete sparse.heart_rate.zones[2];
    const overlap = zonesEnvelope();
    overlap.heart_rate.zones[2].min = 120;
    const nonFinite = zonesEnvelope();
    nonFinite.heart_rate.zones[0].max = Infinity;

    for (const value of [accessor, sparse, overlap, nonFinite, null]) {
        assert.deepEqual(readHeartRateZones(value), []);
    }
});
