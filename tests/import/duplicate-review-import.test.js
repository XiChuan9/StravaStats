import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { createImportStore } from '../../js/storage/index.js';

const BASE_TIME = Date.parse('2026-08-06T01:00:00.000Z');

function ids() {
    let sequence = 0;
    return kind => `duplicate-${kind}-${++sequence}`;
}

function bundle({
    id,
    startTimeUtc,
    sportCategory = 'run',
    distanceMeters = 10_000,
    movingTimeSeconds = 3_000,
    externalId = null
}) {
    return {
        schemaVersion: 1,
        activity: {
            schemaVersion: 1,
            id,
            sportCategory,
            sportVariant: null,
            startTimeUtc,
            timeZone: { ianaName: 'Etc/UTC', utcOffsetMinutes: 0 },
            capabilities: {
                hasGps: false,
                hasHeartRate: false,
                hasPower: false,
                hasCadence: false,
                hasLaps: false
            },
            name: null,
            distanceMeters,
            movingTimeSeconds,
            elapsedTimeSeconds: movingTimeSeconds,
            elevationGainMeters: 0
        },
        streams: { activityId: id, series: [] },
        laps: [],
        events: [],
        sources: [{
            id: `${id}-source`,
            activityId: id,
            provider: 'synthetic-provider',
            externalId,
            rawArtifactId: null,
            acquisitionMethod: 'local-file',
            deviceId: null,
            importedAt: '2026-08-06T01:05:00.000Z'
        }],
        devices: [],
        warnings: [],
        versionMetadata: {
            schemaVersion: 1,
            parserVersion: 'synthetic-json@1',
            normalizerVersion: 'import-normalizer@1',
            analysisVersion: null,
            settingsVersion: null,
            inputHash: null
        }
    };
}

function artifact(value) {
    return {
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content: JSON.stringify(value)
    };
}

function harness() {
    const indexedDB = new IDBFactory();
    let tick = 0;
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => BASE_TIME + tick++,
        applicationVersion: 'duplicate-review-import@1'
    });
    const service = createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: ids()
    });
    return { importStore, service };
}

test('near same-sport import becomes review_required and report exposes no IDs', async () => {
    const { importStore, service } = harness();
    await service.initialize();
    const first = await service.importArtifacts([artifact(bundle({
        id: 'opaque-activity-left',
        startTimeUtc: '2026-08-06T00:00:00.000Z'
    }))]);
    assert.equal((await service.waitForJob(first.jobId)).totals.completed, 1);

    const second = await service.importArtifacts([artifact(bundle({
        id: 'opaque-activity-right',
        startTimeUtc: '2026-08-06T00:00:20.000Z',
        distanceMeters: 9_950,
        movingTimeSeconds: 2_985
    }))]);
    const report = await service.waitForJob(second.jobId);

    assert.deepEqual(report.totals, {
        total: 1,
        completed: 0,
        reviewRequired: 1,
        skippedExactDuplicate: 0,
        failed: 0,
        cancelled: 0
    });
    assert.equal(report.items[0].outcome, 'review_required');
    assert.equal((await service.previewActivities()).total, 2);
    assert.equal((await importStore.listDuplicateReviewCandidates()).length, 1);
    assert.doesNotMatch(
        JSON.stringify(report),
        /opaque-activity|duplicate-candidate|synthetic-provider|2026-08-06T00:/
    );
    await service.close();
});

test('exact provider identity keeps PR-19 precedence and creates no fuzzy candidate', async () => {
    const { importStore, service } = harness();
    await service.initialize();
    const first = await service.importArtifacts([artifact(bundle({
        id: 'exact-left',
        externalId: 'opaque-external',
        startTimeUtc: '2026-08-06T00:00:00.000Z'
    }))]);
    await service.waitForJob(first.jobId);
    const second = await service.importArtifacts([artifact(bundle({
        id: 'exact-right',
        externalId: 'opaque-external',
        startTimeUtc: '2026-08-06T00:00:01.000Z'
    }))]);
    const report = await service.waitForJob(second.jobId);

    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.reviewRequired, 0);
    assert.equal((await service.previewActivities()).total, 1);
    assert.deepEqual(await importStore.listDuplicateReviewCandidates(), []);
    await service.close();
});

test('cross-sport and missing comparison values remain ordinary completed imports', async () => {
    for (const variant of ['cross-sport', 'missing-distance']) {
        const { importStore, service } = harness();
        await service.initialize();
        const firstValue = bundle({
            id: `${variant}-left`,
            startTimeUtc: '2026-08-06T00:00:00.000Z'
        });
        const secondValue = bundle({
            id: `${variant}-right`,
            startTimeUtc: '2026-08-06T00:00:01.000Z',
            sportCategory: variant === 'cross-sport' ? 'ride' : 'run'
        });
        if (variant === 'missing-distance') {
            secondValue.activity.distanceMeters = null;
        }
        const left = await service.importArtifacts([artifact(firstValue)]);
        await service.waitForJob(left.jobId);
        const right = await service.importArtifacts([artifact(secondValue)]);
        const report = await service.waitForJob(right.jobId);
        assert.equal(report.totals.reviewRequired, 0, variant);
        assert.deepEqual(await importStore.listDuplicateReviewCandidates(), [], variant);
        await service.close();
    }
});
