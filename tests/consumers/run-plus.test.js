import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    REPOSITORY_SOURCE,
    REPOSITORY_WARNING_CODE
} from '../../js/repository/index.js';

const mainSource = await readFile(
    new URL('../../js/app/main.js', import.meta.url),
    'utf8'
);
const runPlusSource = await readFile(
    new URL('../../js/tabs/run-plus.js', import.meta.url),
    'utf8'
);

function compileBoundary() {
    const startMarker = '// PR04A_B1_SUMMARY_BOUNDARY_START';
    const endMarker = '// PR04A_B1_SUMMARY_BOUNDARY_END';
    const start = mainSource.indexOf(startMarker);
    const end = mainSource.indexOf(endMarker);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const source = mainSource
        .slice(start + startMarker.length, end)
        .replace(/export\s+(async\s+)?function/g, '$1function');
    return Function(
        'createRepository',
        'REPOSITORY_SOURCE',
        'REPOSITORY_WARNING_CODE',
        'APP_SESSION_MODE',
        'getFeatureFlags',
        'getApplicationShadowWriter',
        `"use strict";${source};return {createSummaryRepositorySession,createRunPlusRenderOptions};`
    )(
        () => { throw new Error('Unexpected default Repository construction.'); },
        REPOSITORY_SOURCE,
        REPOSITORY_WARNING_CODE,
        Object.freeze({ DEMO: 'demo', REAL: 'real' }),
        () => Object.freeze({ dataRepositoryMode: 'canonical' }),
        () => null
    );
}

function envelope(data) {
    return Object.freeze({
        data,
        source: REPOSITORY_SOURCE.CANONICAL,
        warnings: Object.freeze([]),
        partial: false
    });
}

function createSession(boundary) {
    return boundary.createSummaryRepositorySession({
        sessionMode: 'real',
        repositoryFactory: () => ({
            async listActivities() { return envelope(Object.freeze([])); },
            async getActivity(activityId) { return envelope({ id: activityId }); },
            async getStreams() { return envelope({ time: { data: [0] } }); },
            async getAthlete() { return envelope(null); },
            async getZones() { return envelope(null); },
            async getGears() { return envelope(Object.freeze([])); }
        })
    });
}

test('Run Plus receives a frozen narrow AnalysisContext snapshot', () => {
    const boundary = compileBoundary();
    const options = boundary.createRunPlusRenderOptions({
        sessionRepository: createSession(boundary),
        sessionGears: [],
        onFiltersChange() {},
        analysisContext: Object.freeze({
            schemaVersion: 1,
            status: 'configured',
            revision: 1,
            heartRate: Object.freeze({
                maxBpm: 188,
                restingBpm: 48,
                thresholdBpm: 169,
                zones: Object.freeze([])
            }),
            trainingZones: Object.freeze({}),
            advancedAnalysisProfile: Object.freeze({})
        })
    });

    assert.deepEqual(options.analysisContext, {
        status: 'configured',
        heartRate: {
            maxBpm: 188,
            restingBpm: 48,
            thresholdBpm: 169
        }
    });
    assert.equal(Object.isFrozen(options.analysisContext), true);
    assert.equal(Object.isFrozen(options.analysisContext.heartRate), true);
});

test('Run Plus context accessors fail closed without disclosing or invoking health data', () => {
    const boundary = compileBoundary();
    let getterCalls = 0;
    const unsafeContext = { status: 'configured' };
    Object.defineProperty(unsafeContext, 'heartRate', {
        enumerable: true,
        get() {
            getterCalls += 1;
            throw new Error('private health value');
        }
    });

    assert.throws(
        () => boundary.createRunPlusRenderOptions({
            sessionRepository: createSession(boundary),
            sessionGears: [],
            onFiltersChange() {},
            analysisContext: unsafeContext
        }),
        error => error?.name === 'OperationalError'
            && error.message === 'Operation failed.'
    );
    assert.equal(getterCalls, 0);
});

test('Run Plus withholds easy-discipline credit and status without a configured HR cap', () => {
    assert.match(
        runPlusSource,
        /const easyDiscipline = hasPersonalizedCap && easy\.length[\s\S]*?: null;/
    );
    assert.match(runPlusSource, /\+ \(easyDiscipline \?\? 0\) \* 10/);
    assert.match(runPlusSource, /row\.hasPersonalizedCap[\s\S]*?'Profile required'/);
    assert.match(runPlusSource, /!easy\.hasPersonalizedCap[\s\S]*?profile required/);
});
