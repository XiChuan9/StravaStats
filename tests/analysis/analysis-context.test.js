import assert from 'node:assert/strict';
import test from 'node:test';

import { preprocessActivities } from '../../js/shared/preprocessing/index.js';
import { ActivityAnalysisEngine } from '../../js/analysis/index.js';
import {
    BaseAnalyzer,
    getAnalyzerForSport
} from '../../js/analysis/analyzers/index.js';
import { PhysiologyEngine } from '../../js/analysis/engines/physiology.js';
import {
    createAnalysisContextV1,
    projectAdvancedAnalysisProfile
} from '../../js/app/analysis-profile.js';

function configuredContext({
    maxBpm = 200,
    restingBpm = 50,
    thresholdBpm = 170,
    bounds = [120, 140, 160, 180]
} = {}) {
    const starts = [1, ...bounds];
    return Object.freeze({
        status: 'configured',
        heartRate: Object.freeze({
            maxBpm,
            restingBpm,
            thresholdBpm,
            zones: Object.freeze(starts.map((minBpm, index) => Object.freeze({
                id: `z${index + 1}`,
                minBpm,
                maxBpmExclusive: index === 4 ? null : bounds[index]
            })))
        })
    });
}

const UNCONFIGURED_CONTEXT = Object.freeze({
    status: 'unconfigured',
    heartRate: null
});

function syntheticRun(overrides = {}) {
    return {
        id: 'synthetic-run',
        type: 'Run',
        sport_type: 'Run',
        start_date_local: '2026-01-02T06:00:00',
        moving_time: 3600,
        elapsed_time: 3600,
        distance: 10000,
        average_heartrate: 150,
        ...overrides
    };
}

function physiologyTrack(heartRates) {
    return {
        points: heartRates.map((heart_rate, index) => ({
            heart_rate,
            moving: true,
            speed: 10 + index,
            power: null
        }))
    };
}

test('preprocessing preserves the four-argument Legacy calculation path', async () => {
    const activity = syntheticRun();
    const [processed] = await preprocessActivities([activity], { max_hr: 200 }, null, []);

    assert.equal(processed.tss_method, 'heartrate');
    assert.equal(processed.tss, 60.19);
    assert.equal(typeof processed.vo2max, 'number');
    assert.equal(Object.hasOwn(processed, 'tss_profile_status'), false);
    assert.equal(Object.hasOwn(processed, 'recovery_profile_status'), false);
    assert.equal(Object.hasOwn(processed, 'vo2max_profile_status'), false);
});

test('configured preprocessing uses one profile for HR TSS, VO2max, and recovery', async () => {
    const activity = syntheticRun();
    const [processed] = await preprocessActivities(
        [activity],
        { max_hr: 175 },
        { heart_rate: { zones: [{ min: 0, max: 100 }] } },
        [],
        configuredContext()
    );

    assert.equal(processed.tss_method, 'heartrate_zones');
    assert.equal(processed.tss_profile_status, 'configured');
    assert.equal(processed.tss_estimate_scope, 'personalized');
    assert.equal(processed.vo2max_profile_status, 'configured');
    assert.equal(processed.vo2max_estimate_scope, 'personalized');
    assert.equal(processed.recovery_profile_status, 'configured');
    assert.equal(processed.recovery_estimate_scope, 'personalized');

    const higherMaxRun = syntheticRun({ id: 'synthetic-higher-max' });
    const [higherMaxProcessed] = await preprocessActivities(
        [higherMaxRun],
        {},
        null,
        [],
        configuredContext({ maxBpm: 210, bounds: [126, 147, 168, 189] })
    );
    assert.notEqual(processed.tss, higherMaxProcessed.tss);
    assert.notEqual(processed.vo2max, higherMaxProcessed.vo2max);
});

test('unconfigured Canonical preprocessing never falls back to max HR 190', async () => {
    const [processed] = await preprocessActivities(
        [syntheticRun()],
        { max_hr: 190 },
        { heart_rate: { zones: [{ min: 1, max: 190 }] } },
        [],
        UNCONFIGURED_CONTEXT
    );

    assert.equal(processed.tss_method, 'time');
    assert.equal(processed.tss, 38.52);
    assert.equal(processed.tss_profile_status, 'unconfigured');
    assert.equal(processed.tss_estimate_scope, 'general');
    assert.equal(processed.vo2max, null);
    assert.equal(processed.vo2max_profile_status, 'unconfigured');
    assert.equal(processed.vo2max_estimate_scope, 'unavailable');
    assert.equal(processed.recovery_profile_status, 'unconfigured');
    assert.equal(processed.recovery_estimate_scope, 'general');
});

test('Canonical preprocessing does not manufacture HR metrics when the activity has no HR', async () => {
    const [processed] = await preprocessActivities(
        [syntheticRun({ average_heartrate: null })],
        {},
        null,
        [],
        configuredContext()
    );

    assert.equal(processed.tss_method, 'time');
    assert.equal(processed.tss_estimate_scope, 'general');
    assert.equal(processed.vo2max, null);
    assert.equal(processed.vo2max_estimate_scope, 'unavailable');
    assert.equal(processed.recovery_estimate_scope, 'general');
});

test('unconfigured non-HR TSS remains available but is labeled general', async () => {
    const [processed] = await preprocessActivities(
        [syntheticRun({ average_watts: 200, ftp: 250 })],
        {},
        null,
        [],
        UNCONFIGURED_CONTEXT
    );

    assert.equal(processed.tss_method, 'power');
    assert.equal(processed.tss_profile_status, 'unconfigured');
    assert.equal(processed.tss_estimate_scope, 'general');
    assert.equal(processed.vo2max, null);
});

test('explicit malformed Canonical context fails closed instead of using Legacy inputs', async () => {
    const malformed = {
        status: 'configured',
        heartRate: {
            maxBpm: 200,
            zones: [{ id: 'z1', minBpm: 1, maxBpmExclusive: null }]
        }
    };
    const [processed] = await preprocessActivities(
        [syntheticRun()],
        { max_hr: 200 },
        null,
        [],
        malformed
    );

    assert.equal(processed.tss_method, 'time');
    assert.equal(processed.tss_profile_status, 'unconfigured');
    assert.equal(processed.vo2max, null);
});

test('configured zones must start at one before HR calculations can be personalized', async () => {
    const malformed = {
        status: 'configured',
        heartRate: {
            maxBpm: 200,
            restingBpm: null,
            thresholdBpm: null,
            zones: [
                { id: 'z1', minBpm: 50, maxBpmExclusive: 120 },
                { id: 'z2', minBpm: 120, maxBpmExclusive: 140 },
                { id: 'z3', minBpm: 140, maxBpmExclusive: 160 },
                { id: 'z4', minBpm: 160, maxBpmExclusive: 180 },
                { id: 'z5', minBpm: 180, maxBpmExclusive: null }
            ]
        }
    };
    const [processed] = await preprocessActivities(
        [syntheticRun({ average_heartrate: 40 })],
        {},
        null,
        [],
        malformed
    );

    assert.equal(processed.tss_method, 'time');
    assert.equal(processed.tss_profile_status, 'unconfigured');
    assert.equal(processed.tss_estimate_scope, 'general');
    assert.equal(processed.vo2max, null);
});

test('advanced engine accepts direct and wrapped AnalysisContext without changing FTP', async () => {
    const context = configuredContext();
    const direct = new ActivityAnalysisEngine(context);
    const wrapped = new ActivityAnalysisEngine({ analysisContext: context, ftp: 275 });

    assert.equal(direct.config.analysis_context_status, 'configured');
    assert.equal(direct.config.max_hr, 200);
    assert.equal(direct.config.hr_rest, 50);
    assert.equal(direct.config.lthr, 170);
    assert.equal(direct.config.hr_zones.length, 5);
    assert.equal(wrapped.config.ftp, 275);
    assert.equal(wrapped.config.max_hr, 200);

    const analyzer = await getAnalyzerForSport(
        'Run',
        {
            activity_id: 'synthetic-run',
            sport_type: 'Run',
            points: [119, 120, 139, 140, 159, 160, 179, 180].map(heart_rate => ({
                heart_rate
            }))
        },
        wrapped.config
    );
    assert.equal(analyzer.config.analysis_context_status, 'configured');
    assert.equal(analyzer.config.max_hr, 200);
    assert.equal(analyzer.config.hr_zones.length, 5);
    analyzer._calculateHRZones();
    assert.deepEqual(analyzer.result.hr_zones, {
        Z1: 13,
        Z2: 25,
        Z3: 25,
        Z4: 25,
        Z5: 13
    });
});

test('advanced engine accepts the frozen snake-case Advanced Analysis projection', () => {
    const projection = {
        max_hr: 200,
        hr_rest: 50,
        lthr: 170,
        hr_zones: [
            { min: 1, max: 120 },
            { min: 120, max: 140 },
            { min: 140, max: 160 },
            { min: 160, max: 180 },
            { min: 180, max: -1 }
        ],
        ftp: 280
    };
    const engine = new ActivityAnalysisEngine(projection);

    assert.equal(engine.config.analysis_context_status, 'configured');
    assert.equal(engine.config.max_hr, 200);
    assert.equal(engine.config.hr_rest, 50);
    assert.equal(engine.config.lthr, 170);
    assert.equal(engine.config.hr_zones[4].maxBpmExclusive, null);
    assert.equal(engine.config.ftp, 280);
});

test('profile contract projections feed preprocessing and Advanced Analysis unchanged', async () => {
    const context = createAnalysisContextV1({
        schemaVersion: 1,
        revision: 1,
        heartRate: {
            maxBpm: 200,
            restingBpm: null,
            thresholdBpm: null,
            zoneMode: 'percent-max',
            upperBoundsBpm: [120, 140, 160, 180]
        }
    });
    const [processed] = await preprocessActivities(
        [syntheticRun()],
        {},
        null,
        [],
        context
    );
    const engine = new ActivityAnalysisEngine(projectAdvancedAnalysisProfile(context));

    assert.equal(context.status, 'configured');
    assert.equal(processed.tss_profile_status, 'configured');
    assert.equal(processed.tss_method, 'heartrate_zones');
    assert.equal(engine.config.analysis_context_status, 'configured');
    assert.equal(engine.config.max_hr, context.heartRate.maxBpm);
    assert.deepEqual(
        engine.config.hr_zones.map(zone => [zone.minBpm, zone.maxBpmExclusive]),
        context.heartRate.zones.map(zone => [zone.minBpm, zone.maxBpmExclusive])
    );
});

test('a Legacy profile without the complete Advanced projection keeps Legacy semantics', () => {
    const engine = new ActivityAnalysisEngine({ max_hr: 185, ftp: 255 });

    assert.equal(engine.config.max_hr, 185);
    assert.equal(engine.config.ftp, 255);
    assert.equal(Object.hasOwn(engine.config, 'analysis_context_status'), false);
});

test('Legacy sport zones keep the historical 195 bpm basis when config carries max_hr', () => {
    const analyzer = new BaseAnalyzer({
        activity_id: 'synthetic-legacy-analysis',
        sport_type: 'Run',
        points: [{ heart_rate: 114 }]
    }, {
        max_hr: 185
    });

    analyzer._calculateHRZones();
    assert.deepEqual(analyzer.result.hr_zones, {
        Z1: 100,
        Z2: 0,
        Z3: 0,
        Z4: 0,
        Z5: 0
    });
    assert.equal(Object.hasOwn(analyzer.result, 'hr_zones_profile_status'), false);
});

test('advanced engine makes malformed or unconfigured contexts explicitly unavailable', () => {
    const unconfigured = new ActivityAnalysisEngine({
        analysisContext: UNCONFIGURED_CONTEXT,
        ftp: 260
    });
    const malformed = new ActivityAnalysisEngine({
        ...configuredContext(),
        heartRate: { ...configuredContext().heartRate, zones: [] }
    });
    const malformedProjection = new ActivityAnalysisEngine({
        max_hr: 200,
        hr_rest: 50,
        lthr: 170,
        hr_zones: []
    });

    for (const engine of [unconfigured, malformed, malformedProjection]) {
        assert.equal(engine.config.analysis_context_status, 'unconfigured');
        assert.equal(engine.config.max_hr, null);
        assert.equal(engine.config.lthr, null);
        assert.equal(engine.config.hr_rest, null);
        assert.equal(engine.config.hr_zones, null);
    }
    assert.equal(unconfigured.config.ftp, 260);
});

test('PhysiologyEngine uses configured custom zones and optional threshold inputs', () => {
    const config = new ActivityAnalysisEngine(configuredContext()).config;
    const result = new PhysiologyEngine(config).analyze(
        physiologyTrack([119, 120, 139, 140, 159, 160, 179, 180]),
        { pace_avg: { minutes: 5, seconds: 0 } }
    );

    assert.deepEqual(result.heart_rate.zones, {
        Z1: 13,
        Z2: 25,
        Z3: 25,
        Z4: 25,
        Z5: 13
    });
    assert.equal(result.heart_rate.intensity_factor, 0.75);
    assert.equal(result.heart_rate.profile_status, 'configured');
    assert.equal(typeof result.stress.time_above_threshold_pct, 'number');
    assert.equal(typeof result.stress.recovery_index, 'string');
});

test('PhysiologyEngine keeps its existing Legacy defaults when no context is supplied', () => {
    const result = new PhysiologyEngine().analyze(
        physiologyTrack([150, 180]),
        { pace_avg: { minutes: 5, seconds: 0 } }
    );

    assert.equal(result.heart_rate.intensity_factor, 0.85);
    assert.deepEqual(result.heart_rate.zones, {
        Z1: 0,
        Z2: 0,
        Z3: 50,
        Z4: 0,
        Z5: 50
    });
    assert.equal(result.stress.time_above_threshold_pct, 50);
    assert.equal(result.stress.recovery_index, 'good');
    assert.equal(Object.hasOwn(result.heart_rate, 'profile_status'), false);
    assert.equal(Object.hasOwn(result.stress, 'profile_status'), false);
});

test('PhysiologyEngine retains raw HR but withholds personalized metrics when unconfigured', () => {
    const config = new ActivityAnalysisEngine(UNCONFIGURED_CONTEXT).config;
    const result = new PhysiologyEngine(config).analyze(
        physiologyTrack([130, 150, 170]),
        { pace_avg: { minutes: 5, seconds: 0 } }
    );

    assert.equal(result.heart_rate.avg, 150);
    assert.equal(result.heart_rate.max, 170);
    assert.equal(result.heart_rate.intensity_factor, null);
    assert.equal(result.heart_rate.zones, null);
    assert.equal(result.heart_rate.profile_status, 'unconfigured');
    assert.equal(typeof result.efficiency.speed_per_hr, 'number');
    assert.equal(result.stress.time_above_threshold_pct, null);
    assert.equal(result.stress.recovery_index, null);
    assert.equal(result.stress.stress_level, null);
    assert.equal(result.stress.profile_status, 'unconfigured');
});

test('configured context with optional HR inputs missing withholds only dependent metrics', () => {
    const context = configuredContext({ restingBpm: null, thresholdBpm: null });
    const config = new ActivityAnalysisEngine(context).config;
    const result = new PhysiologyEngine(config).analyze(
        physiologyTrack([130, 150, 170]),
        { pace_avg: { minutes: 5, seconds: 0 } }
    );

    assert.equal(typeof result.heart_rate.intensity_factor, 'number');
    assert.equal(typeof result.heart_rate.zones.Z3, 'number');
    assert.equal(result.stress.time_above_threshold_pct, null);
    assert.equal(result.stress.recovery_index, null);
    assert.equal(result.stress.stress_level, null);
    assert.equal(result.stress.profile_status, 'configured');
});
