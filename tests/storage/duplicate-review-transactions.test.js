import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    SYNTHETIC_JSON_MEDIA_TYPE,
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { createCanonicalStore, createImportStore } from '../../js/storage/index.js';

const BASE_TIME = Date.parse('2026-08-06T02:00:00.000Z');

function ids() {
    let sequence = 0;
    return kind => `transaction-${kind}-${++sequence}`;
}

function bundle(id, seconds = 0, overrides = {}) {
    const startTimeUtc = new Date(Date.parse('2026-08-06T00:00:00.000Z')
        + seconds * 1_000).toISOString();
    const activity = {
        schemaVersion: 1,
        id,
        sportCategory: 'run',
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
        distanceMeters: 10_000,
        movingTimeSeconds: 3_000,
        elapsedTimeSeconds: 3_000,
        elevationGainMeters: 0,
        ...overrides
    };
    return {
        schemaVersion: 1,
        activity,
        streams: { activityId: id, series: [] },
        laps: [], events: [], devices: [], warnings: [],
        sources: [{
            id: `${id}-source`, activityId: id,
            provider: 'synthetic-provider', externalId: null,
            rawArtifactId: null, acquisitionMethod: 'local-file',
            deviceId: null, importedAt: '2026-08-06T00:05:00.000Z'
        }],
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

function createHarness(indexedDB = new IDBFactory(), suppliedNow = null) {
    let tick = 0;
    const importStore = createImportStore({
        indexedDB, IDBKeyRange,
        now: suppliedNow || (() => BASE_TIME + tick++),
        applicationVersion: 'duplicate-review-transactions@1'
    });
    const service = createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: ids()
    });
    return { indexedDB, importStore, service };
}

async function importBundle(service, value) {
    const started = await service.importArtifacts([{
        mediaType: SYNTHETIC_JSON_MEDIA_TYPE,
        content: JSON.stringify(value)
    }]);
    return service.waitForJob(started.jobId);
}

test('confirm and reject decisions are atomic, idempotent, and never coalesce activities', async () => {
    const { importStore, service } = createHarness();
    await service.initialize();
    await importBundle(service, bundle('opaque-left'));
    await importBundle(service, bundle('opaque-right', 10));
    const [candidate] = await importStore.listDuplicateReviewCandidates();
    assert.equal(candidate.status, 'review_required');

    const before = await service.previewActivities();
    const first = await importStore.decideDuplicateReviewCandidate(
        candidate.id,
        'confirmed_same'
    );
    const repeated = await importStore.decideDuplicateReviewCandidate(
        candidate.id,
        'confirmed_same'
    );
    assert.deepEqual(repeated, first);
    await assert.rejects(
        importStore.decideDuplicateReviewCandidate(candidate.id, 'rejected'),
        error => error.code === 'CONFLICT'
    );
    assert.deepEqual(await service.previewActivities(), before);
    assert.deepEqual(await importStore.listDuplicateReviewCandidates(), []);
    const reviewed = await importStore.getDuplicateReviewCandidate(candidate.id);
    assert.equal(reviewed.status, 'confirmed_same');
    assert.equal(reviewed.activities.length, 2);
    assert.doesNotMatch(JSON.stringify(reviewed.activities), /opaque-left|opaque-right/);
    await service.close();
});

test('terminal decision replay returns the stored audit row without new clock work', async () => {
    let tick = 0;
    let clockEnabled = true;
    const { importStore, service } = createHarness(
        new IDBFactory(),
        () => {
            if (!clockEnabled) throw new Error('clock unavailable');
            return BASE_TIME + tick++;
        }
    );
    await service.initialize();
    await importBundle(service, bundle('replay-left'));
    await importBundle(service, bundle('replay-right', 10));
    const [candidate] = await importStore.listDuplicateReviewCandidates();
    const first = await importStore.decideDuplicateReviewCandidate(
        candidate.id,
        'confirmed_same'
    );

    clockEnabled = false;
    assert.deepEqual(
        await importStore.decideDuplicateReviewCandidate(
            candidate.id,
            'confirmed_same'
        ),
        first
    );
    await service.close();
});

test('keep-separate is idempotent and preserves both Canonical graphs', async () => {
    const { importStore, service } = createHarness();
    await service.initialize();
    await importBundle(service, bundle('separate-left'));
    await importBundle(service, bundle('separate-right', 10));
    const [candidate] = await importStore.listDuplicateReviewCandidates();
    const before = await service.previewActivities();

    const first = await importStore.decideDuplicateReviewCandidate(
        candidate.id,
        'rejected'
    );
    const repeated = await importStore.decideDuplicateReviewCandidate(
        candidate.id,
        'rejected'
    );
    assert.deepEqual(repeated, first);
    assert.equal(first.status, 'rejected');
    await assert.rejects(
        importStore.decideDuplicateReviewCandidate(
            candidate.id,
            'confirmed_same'
        ),
        error => error.code === 'CONFLICT'
    );
    assert.deepEqual(await service.previewActivities(), before);
    assert.equal(
        (await importStore.getDuplicateReviewCandidate(candidate.id)).status,
        'rejected'
    );
    await service.close();
});

test('concurrent same and opposing decisions serialize to one append-only result', async () => {
    const same = createHarness();
    await same.service.initialize();
    await importBundle(same.service, bundle('concurrent-same-left'));
    await importBundle(same.service, bundle('concurrent-same-right', 10));
    const [sameCandidate] = await same.importStore.listDuplicateReviewCandidates();
    const sameResults = await Promise.all([
        same.importStore.decideDuplicateReviewCandidate(
            sameCandidate.id,
            'rejected'
        ),
        same.importStore.decideDuplicateReviewCandidate(
            sameCandidate.id,
            'rejected'
        )
    ]);
    assert.deepEqual(sameResults[0], sameResults[1]);
    await same.service.close();

    const opposing = createHarness();
    await opposing.service.initialize();
    await importBundle(opposing.service, bundle('concurrent-opposing-left'));
    await importBundle(opposing.service, bundle('concurrent-opposing-right', 10));
    const [opposingCandidate] =
        await opposing.importStore.listDuplicateReviewCandidates();
    const opposingResults = await Promise.allSettled([
        opposing.importStore.decideDuplicateReviewCandidate(
            opposingCandidate.id,
            'confirmed_same'
        ),
        opposing.importStore.decideDuplicateReviewCandidate(
            opposingCandidate.id,
            'rejected'
        )
    ]);
    assert.equal(
        opposingResults.filter(result => result.status === 'fulfilled').length,
        1
    );
    const [rejected] = opposingResults.filter(result => result.status === 'rejected');
    assert.equal(rejected.reason.code, 'CONFLICT');
    const [winner] = opposingResults.filter(result => result.status === 'fulfilled');
    assert.equal(
        (await opposing.importStore.getDuplicateReviewCandidate(
            opposingCandidate.id
        )).status,
        winner.value.status
    );
    assert.equal((await opposing.service.previewActivities()).total, 2);
    await opposing.service.close();
});

test('21st qualifying candidate aborts activity and every partial candidate atomically', async () => {
    const indexedDB = new IDBFactory();
    const canonical = createCanonicalStore({
        indexedDB, IDBKeyRange,
        now: () => BASE_TIME,
        applicationVersion: 'duplicate-review-seed@1'
    });
    await canonical.initialize();
    for (let index = 0; index < 21; index += 1) {
        await canonical.putBundle(bundle(`seed-${String(index).padStart(2, '0')}`, index));
    }
    await canonical.close();

    const { importStore, service } = createHarness(indexedDB);
    await service.initialize();
    const report = await importBundle(service, bundle('overflow-incoming', 10));
    assert.equal(report.totals.failed, 1);
    assert.equal(report.items[0].errorCode, 'CANDIDATE_LIMIT_EXCEEDED');
    assert.equal((await service.previewActivities()).total, 21);
    assert.deepEqual(await importStore.listDuplicateReviewCandidates(), []);
    assert.doesNotMatch(JSON.stringify(report), /overflow-incoming|seed-/);
    await service.close();
});
