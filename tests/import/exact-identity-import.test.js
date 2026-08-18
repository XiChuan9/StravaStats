import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { ACTIVITIES_CSV_MEDIA_TYPE } from '../../js/import/activities-csv-decoder.js';
import { createImportStore } from '../../js/storage/index.js';

const FIXED_TIME = Date.parse('2026-08-05T01:02:03.004Z');

function ids() {
    let sequence = 0;
    return kind => `exact-${kind}-${++sequence}`;
}

function service(indexedDB) {
    const importStore = createImportStore({
        indexedDB,
        IDBKeyRange,
        now: () => FIXED_TIME,
        applicationVersion: 'exact-identity-import@1'
    });
    return createImportService({
        importStore,
        worker: createInlineImportWorker(),
        crypto: webcrypto,
        createId: ids()
    });
}

function csv(content) {
    return { mediaType: ACTIVITIES_CSV_MEDIA_TYPE, content };
}

test('concurrent different raw bytes with one exact provider identity produce one activity', async () => {
    const core = service(new IDBFactory());
    await core.initialize();
    const header = 'Activity ID,Activity Date,Activity Type,Distance';
    const [left, right] = await Promise.all([
        core.importArtifacts([csv(
            `${header}\nidentity-0,2026-01-01T00:00:00Z,Run,1`
        )]),
        core.importArtifacts([csv(
            `${header}\nidentity-0,2026-01-01T00:00:00Z,"Run",1`
        )])
    ]);
    const reports = await Promise.all([
        core.waitForJob(left.jobId),
        core.waitForJob(right.jobId)
    ]);

    assert.equal(
        reports.reduce((sum, report) => sum + report.totals.completed, 0),
        2
    );
    assert.equal(
        reports.reduce((sum, report) => sum + report.totals.failed, 0),
        0
    );
    assert.equal((await core.previewActivities()).total, 1);
    assert.doesNotMatch(
        JSON.stringify(reports),
        /identity-0|Activity ID|2026-01-01T00:00:00Z/
    );
    await core.close();
});

test('close time, distance, and sport do not merge distinct external identities', async () => {
    const core = service(new IDBFactory());
    await core.initialize();
    const header = 'Activity ID,Activity Date,Activity Type,Distance';
    const input = csv(
        `${header}\nnear-left,2026-01-01T00:00:00Z,Run,10\n`
        + 'near-right,2026-01-01T00:00:01Z,Run,10.0001'
    );
    const job = await core.importArtifacts([input]);
    const report = await core.waitForJob(job.jobId);

    assert.equal(report.totals.completed, 2);
    assert.equal(report.totals.failed, 0);
    assert.equal((await core.previewActivities()).total, 2);
    await core.close();
});
