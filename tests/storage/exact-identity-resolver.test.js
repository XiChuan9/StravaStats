import assert from 'node:assert/strict';
import test from 'node:test';

import {
    resolveExactIdentityCandidates
} from '../../js/storage/exact-identity-resolver.js';

const INSTANT = '2026-08-06T00:00:00.000Z';

function source(overrides = {}) {
    return {
        id: 'incoming-source',
        activityId: 'incoming-activity',
        provider: 'provider-a',
        externalId: 'external-a',
        rawArtifactId: 'raw:synthetic',
        acquisitionMethod: 'synthetic-import',
        deviceId: null,
        importedAt: INSTANT,
        ...overrides
    };
}

function input(overrides = {}) {
    return {
        incomingActivityId: 'incoming-activity',
        incomingSources: [source()],
        sourceIdMatches: [null],
        externalIdMatches: [[]],
        rawArtifactActivityId: null,
        fitActivityId: null,
        fitSources: [],
        ...overrides
    };
}

test('exact provider and opaque external ID resolves one canonical activity', () => {
    const result = resolveExactIdentityCandidates(input({
        externalIdMatches: [[source({
            id: 'stored-source',
            activityId: 'stored-activity'
        })]]
    }));
    assert.deepEqual(result, {
        status: 'exact-match',
        activityId: 'stored-activity'
    });
    assert.equal(Object.isFrozen(result), true);
});

test('string zero is exact while absent, null, numeric zero, and case differ', () => {
    const zeroIncoming = source({ externalId: '0' });
    assert.equal(resolveExactIdentityCandidates(input({
        incomingSources: [zeroIncoming],
        externalIdMatches: [[source({
            id: 'stored-zero',
            activityId: 'stored-zero-activity',
            externalId: '0'
        })]]
    })).status, 'exact-match');

    for (const externalId of [undefined, null, 0]) {
        const candidate = source();
        if (externalId === undefined) delete candidate.externalId;
        else candidate.externalId = externalId;
        assert.equal(resolveExactIdentityCandidates(input({
            incomingSources: [candidate]
        })).status, externalId === 0 ? 'invalid' : 'unmatched');
    }

    assert.equal(resolveExactIdentityCandidates(input({
        externalIdMatches: [[source({
            id: 'case-source',
            activityId: 'case-activity',
            provider: 'Provider-A'
        })]]
    })).status, 'invalid');
});

test('an established source primary ID resolves without external identity', () => {
    const incoming = source({ externalId: null });
    assert.deepEqual(resolveExactIdentityCandidates(input({
        incomingSources: [incoming],
        sourceIdMatches: [source({
            activityId: 'stored-activity',
            externalId: null,
            rawArtifactId: 'raw:prior'
        })]
    })), {
        status: 'exact-match',
        activityId: 'stored-activity'
    });
});

test('trusted FIT file/session identity resolves across different raw hashes', () => {
    const fitId = 'fit-session:1:100:7:1123455940:1123456000';
    const incomingFit = source({
        id: `${fitId}:source:0`,
        activityId: fitId,
        provider: 'fit',
        externalId: null,
        rawArtifactId: 'raw:new'
    });
    const storedFit = source({
        id: `${fitId}:source:0`,
        activityId: fitId,
        provider: 'fit',
        externalId: null,
        rawArtifactId: 'raw:prior'
    });
    assert.deepEqual(resolveExactIdentityCandidates(input({
        incomingActivityId: fitId,
        incomingSources: [incomingFit],
        sourceIdMatches: [null],
        externalIdMatches: [[]],
        fitActivityId: fitId,
        fitSources: [storedFit]
    })), {
        status: 'exact-match',
        activityId: fitId
    });

    for (const invalidId of [
        'fit-session:1:100:7:1123455940',
        'fit-session:1:100:7:01:1123456000',
        'fit-session:1:100:7:-1:1123456000',
        'fit-session:1:100:7:1123455940:9007199254740992'
    ]) {
        assert.equal(resolveExactIdentityCandidates(input({
            incomingActivityId: invalidId,
            incomingSources: [source({
                activityId: invalidId,
                provider: 'fit',
                externalId: null
            })],
            fitActivityId: invalidId,
            fitSources: [source({
                activityId: invalidId,
                provider: 'fit',
                externalId: null
            })]
        })).status, 'unmatched');
    }
});

test('agreeing signals collapse to one target and disagreeing exact signals conflict', () => {
    const sameTarget = source({
        activityId: 'stored-activity'
    });
    assert.equal(resolveExactIdentityCandidates(input({
        sourceIdMatches: [sameTarget],
        externalIdMatches: [[sameTarget]],
        rawArtifactActivityId: 'stored-activity'
    })).status, 'exact-match');

    assert.deepEqual(resolveExactIdentityCandidates(input({
        sourceIdMatches: [source({ activityId: 'stored-a' })],
        externalIdMatches: [[source({
            id: 'other-source',
            activityId: 'stored-b'
        })]]
    })), {
        status: 'conflict',
        activityId: null
    });

    assert.equal(resolveExactIdentityCandidates(input({
        rawArtifactActivityId: 'raw-target'
    })).activityId, 'raw-target');
    assert.equal(resolveExactIdentityCandidates(input({
        rawArtifactActivityId: 'raw-target',
        sourceIdMatches: [source({ activityId: 'source-target' })]
    })).status, 'conflict');
});

test('time, distance, filename, route, statistics, and device labels are inert', () => {
    const candidate = input();
    Object.assign(candidate, {
        startTimeUtc: '2026-08-06T00:00:01.000Z',
        distanceMeters: 10000,
        filename: 'similar.fit',
        route: [[0, 0]],
        statistics: { duration: 3600 },
        deviceLabel: 'similar-device'
    });
    assert.equal(resolveExactIdentityCandidates(candidate).status, 'invalid');
    assert.equal(resolveExactIdentityCandidates(input()).status, 'unmatched');
});

test('unsafe identity inputs fail closed without executing accessors', () => {
    let getterCalls = 0;
    const hostile = input();
    Object.defineProperty(hostile.incomingSources[0], 'externalId', {
        enumerable: true,
        get() {
            getterCalls += 1;
            throw new Error('sensitive accessor');
        }
    });
    assert.deepEqual(resolveExactIdentityCandidates(hostile), {
        status: 'invalid',
        activityId: null
    });
    assert.equal(getterCalls, 0);
});
