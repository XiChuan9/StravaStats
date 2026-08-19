import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

import {
    createImportService,
    createInlineImportWorker
} from '../../js/import/index.js';
import { createRepositoryWithDependencies } from '../../js/repository/factory.js';
import { REPOSITORY_SOURCE } from '../../js/repository/index.js';
import {
    V2_DATABASE_NAME,
    V2_DATABASE_VERSION,
    V2_SCHEMA,
    createImportStore
} from '../../js/storage/index.js';
import { preflightSourceFiles } from
    '../../js/pages/source-manager/source-manager.js';
import { createSyntheticFitActivity } from
    '../fixtures/synthetic/fit/fit-fixture.js';
import { createSyntheticTcxActivity } from
    '../fixtures/synthetic/tcx/tcx-fixture.js';
import {
    PROHIBITED_SCOPE_FILES,
    PROHIBITED_SCOPE_PREFIXES,
    findProhibitedScopeChanges,
    scopeFreezeDiffArgs
} from '../../scripts/check-public-scope-freeze.mjs';

const ROOT = new URL('../../', import.meta.url);
const RETIRED_SLUG = ['run', 'plus'].join('-');
const RETIRED_SYMBOL = ['render', 'Run', 'Plus', 'Tab'].join('');
const RETIRED_TAB = `${RETIRED_SLUG}-tab`;
const RETIRED_SECONDARY = ['n', 'sm'].join('');
const RETIRED_STORAGE_PREFIX = ['run', 'plus'].join('_');
const SCOPE_FREEZE_BRANCH = 'codex/public/local-import-core';

async function source(path) {
    return readFile(new URL(path, ROOT), 'utf8');
}

function syntheticFile(name, content, type) {
    const bytes = content instanceof Uint8Array
        ? content
        : new TextEncoder().encode(content);
    return Object.freeze({
        name,
        size: bytes.byteLength,
        type,
        async arrayBuffer() {
            return bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
            );
        }
    });
}

function createIds(prefix) {
    let sequence = 0;
    return kind => `${prefix}-${kind}-${++sequence}`;
}

test('public shell retires personal surfaces while preserving ordinary Run', async () => {
    const [html, tabs, main] = await Promise.all([
        source('index.html'),
        source('js/tabs/index.js'),
        source('js/app/main.js')
    ]);

    assert.doesNotMatch(html, new RegExp(`${RETIRED_SLUG}\\.css`, 'i'));
    assert.doesNotMatch(html, new RegExp(RETIRED_TAB, 'i'));
    assert.doesNotMatch(html, new RegExp(`>\\s*${RETIRED_SLUG.replace('-', '\\s+')}\\s*<`, 'i'));
    assert.doesNotMatch(tabs, new RegExp(RETIRED_SYMBOL));
    assert.doesNotMatch(tabs, new RegExp(`${RETIRED_SLUG}\\.js`, 'i'));
    assert.doesNotMatch(main, new RegExp(RETIRED_SYMBOL));
    assert.doesNotMatch(main, new RegExp(RETIRED_TAB, 'i'));
    assert.doesNotMatch(main, new RegExp(`/${RETIRED_SLUG}`, 'i'));

    assert.match(html, /data-tab="run-tab"/);
    assert.match(tabs, /renderRunAnalysisTab/);
    assert.match(main, /'\/run':\s*'run-tab'/);
    assert.match(main, /renderRunAnalysisTab\(/);
});

test('loopback route matrices reject retired paths and retain ordinary Run', async () => {
    const [developmentServer, candidateServer] = await Promise.all([
        source('scripts/local-dev-server.mjs'),
        source('scripts/alpha-candidate.mjs')
    ]);
    const retiredRoutes = [
        `/${RETIRED_SLUG}`,
        `/${RETIRED_SLUG}/${RETIRED_SECONDARY}`
    ];

    for (const route of retiredRoutes) {
        assert.equal(developmentServer.includes(`'${route}'`), false, route);
        assert.equal(candidateServer.includes(`'${route}'`), false, route);
    }
    assert.match(developmentServer, /'\/run'/);
    assert.match(candidateServer, /'\/run'/);
});

test('Source Manager FIT and TCX imports remain visible through Repository', async () => {
    const cases = [
        {
            provider: 'fit',
            file: syntheticFile(
                'synthetic.fit',
                createSyntheticFitActivity(),
                'application/vnd.ant.fit'
            )
        },
        {
            provider: 'tcx',
            file: syntheticFile(
                'synthetic.tcx',
                createSyntheticTcxActivity(),
                'application/vnd.garmin.tcx+xml'
            )
        }
    ];

    for (const { provider, file } of cases) {
        const [preflight] = await preflightSourceFiles([file]);
        assert.equal(preflight.ok, true, provider);

        const indexedDB = new IDBFactory();
        const importStore = createImportStore({
            indexedDB,
            IDBKeyRange,
            now: () => Date.parse('2034-01-02T03:04:05.006Z'),
            applicationVersion: 'public-local-import-core-test@1'
        });
        const service = createImportService({
            importStore,
            worker: createInlineImportWorker(),
            crypto: webcrypto,
            createId: createIds(`public-${provider}`)
        });
        await service.initialize();

        try {
            const first = await service.importArtifacts([preflight.artifact]);
            const firstReport = await service.waitForJob(first.jobId);
            assert.equal(firstReport.totals.completed, 1, provider);
            assert.equal(firstReport.totals.failed, 0, provider);

            const repository = createRepositoryWithDependencies({
                sessionMode: 'real',
                mode: 'canonical'
            }, {
                canonicalStoreFactory: () => importStore
            });
            const activities = await repository.listActivities();
            assert.equal(activities.source, REPOSITORY_SOURCE.CANONICAL, provider);
            assert.equal(activities.partial, false, provider);
            assert.equal(activities.data.length, 1, provider);
            assert.equal(typeof activities.data[0].id, 'string', provider);

            const duplicate = await service.importArtifacts([preflight.artifact]);
            const duplicateReport = await service.waitForJob(duplicate.jobId);
            assert.equal(
                duplicateReport.totals.skippedExactDuplicate,
                1,
                provider
            );
            assert.equal(
                (await repository.listActivities()).data.length,
                1,
                provider
            );
        } finally {
            await service.close();
        }
    }
});

test('scope freeze preserves V6 schema and historical settings compatibility', async () => {
    assert.equal(V2_DATABASE_NAME, 'strava-stats-v2');
    assert.equal(V2_DATABASE_VERSION, 6);
    assert.equal(V2_SCHEMA.indexedDbVersion, 6);
    assert.equal(V2_SCHEMA.schemaId, 'strava-stats-v2@6');

    const historicalKeys = [
        `${RETIRED_STORAGE_PREFIX}_capacity_inputs_v1`,
        `${RETIRED_STORAGE_PREFIX}_${RETIRED_SECONDARY}_settings_v1`,
        `${RETIRED_STORAGE_PREFIX}_${RETIRED_SECONDARY}_activity_tags_v1`,
        `${RETIRED_STORAGE_PREFIX}_${RETIRED_SECONDARY}_session_inputs_v1`,
        `${RETIRED_STORAGE_PREFIX}_${RETIRED_SECONDARY}_tests_v1`,
        `${RETIRED_STORAGE_PREFIX}_${RETIRED_SECONDARY}_interval_analysis_v1`
    ];
    const compatibilitySources = await Promise.all([
        source('js/app/storage-backup.js'),
        source('js/backup/backup-service.js'),
        source('js/services/legacy-cache/constants.js')
    ]);
    for (const key of historicalKeys) {
        for (const compatibilitySource of compatibilitySources) {
            assert.equal(compatibilitySource.includes(`'${key}'`), true, key);
        }
    }

    const publicRuntime = await source('js/app/main.js');
    for (const key of historicalKeys) {
        assert.equal(publicRuntime.includes(key), false, key);
    }
});

test('scope freeze changed-path classifier covers every literal prohibited boundary', () => {
    const prohibited = [
        ...PROHIBITED_SCOPE_PREFIXES.map(prefix => `${prefix}synthetic.js`),
        ...PROHIBITED_SCOPE_FILES,
        'LICENSE',
        'LICENSE.md',
        'LICENSES',
        'LICENSE_extra',
        'licenses/LICENSE.md'
    ];
    assert.deepEqual(findProhibitedScopeChanges(prohibited), [...prohibited].sort());
    assert.deepEqual(findProhibitedScopeChanges([
        'docs/testing/regression-matrix.md',
        'scripts/check-privacy.mjs',
        'tests/public/local-import-core-freeze.test.js'
    ]), []);
    assert.deepEqual(
        scopeFreezeDiffArgs('synthetic-base'),
        ['diff', '--no-renames', '--name-only', '-z', 'synthetic-base', '--']
    );
});

function currentTaskBranch() {
    if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_HEAD_REF) {
        return process.env.GITHUB_HEAD_REF;
    }
    try {
        return execFileSync('git', ['branch', '--show-current'], {
            cwd: new URL('../../', import.meta.url),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch {
        return '';
    }
}

test('current public scope-freeze branch changes no prohibited path', {
    skip: currentTaskBranch() !== SCOPE_FREEZE_BRANCH
}, () => {
    assert.doesNotThrow(() => execFileSync(
        process.execPath,
        ['scripts/check-public-scope-freeze.mjs'],
        {
            cwd: new URL('../../', import.meta.url),
            encoding: 'utf8',
            stdio: 'pipe'
        }
    ));
});
