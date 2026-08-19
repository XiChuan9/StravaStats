import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import {
    mkdir,
    mkdtemp,
    readFile,
    rename,
    rm,
    writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    PUBLIC_SCOPE_FREEZE_ALLOWED_PATHS,
    PUBLIC_SCOPE_FREEZE_BRANCH,
    PROHIBITED_SCOPE_FILES,
    PROHIBITED_SCOPE_PREFIXES,
    findProhibitedScopeChanges,
    findUnlistedScopeChanges,
    isPublicScopeFreezeBranch,
    listScopeFreezeChanges,
    resolveScopeFreezeBranch,
    scopeFreezeDiffArgs
} from '../../scripts/check-public-scope-freeze.mjs';

const ROOT = new URL('../../', import.meta.url);
const RETIRED_SLUG = ['run', 'plus'].join('-');
const RETIRED_SYMBOL = ['render', 'Run', 'Plus', 'Tab'].join('');
const RETIRED_TAB = `${RETIRED_SLUG}-tab`;
const RETIRED_SECONDARY = ['n', 'sm'].join('');
const RETIRED_STORAGE_PREFIX = ['run', 'plus'].join('_');

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

test('scope freeze code allowlist exactly matches the Task Brief literal paths', async () => {
    const taskBrief = await source('docs/tasks/public-local-import-core-freeze.md');
    const literalBlock = taskBrief.match(
        /## Literal allowed paths[\s\S]*?```text\n([\s\S]*?)\n```/
    );
    assert.ok(literalBlock, 'Task Brief literal allowlist block must exist');

    const documentedPaths = literalBlock[1]
        .split('\n')
        .map(path => path.trim())
        .filter(Boolean);
    assert.deepEqual(
        PUBLIC_SCOPE_FREEZE_ALLOWED_PATHS,
        documentedPaths,
        'runtime guard and Task Brief allowlists must not drift'
    );
    assert.equal(
        new Set(PUBLIC_SCOPE_FREEZE_ALLOWED_PATHS).size,
        PUBLIC_SCOPE_FREEZE_ALLOWED_PATHS.length,
        'literal allowlist must not contain duplicates'
    );
});

test('scope freeze rejects ordinary unlisted paths as well as prohibited paths', () => {
    const allowed = [
        'README.md',
        'scripts/check-public-scope-freeze.mjs',
        'tests/public/local-import-core-freeze.test.js'
    ];
    assert.deepEqual(findUnlistedScopeChanges(allowed), []);
    assert.deepEqual(findUnlistedScopeChanges([
        ...allowed,
        'docs/not-listed.md',
        'scripts/not-listed.mjs',
        'docs/not-listed.md'
    ]), [
        'docs/not-listed.md',
        'scripts/not-listed.mjs'
    ]);

    const prohibited = [
        'js/import/escape.js',
        'js/tabs/run-analysis.js',
        'LICENSE.md'
    ];
    const expected = [...prohibited].sort();
    assert.deepEqual(findProhibitedScopeChanges(prohibited), expected);
    assert.deepEqual(findUnlistedScopeChanges(prohibited), expected);
});

function git(cwd, args) {
    return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
}

test('scope freeze diff sees HEAD, index, worktree, untracked, and both rename paths', async () => {
    const repository = await mkdtemp(join(tmpdir(), 'scope-freeze-allowlist-'));
    try {
        git(repository, ['init', '--quiet']);
        git(repository, ['config', 'user.name', 'Scope Guard Test']);
        git(repository, ['config', 'user.email', 'scope-guard@example.invalid']);
        await mkdir(join(repository, 'docs'), { recursive: true });
        await mkdir(join(repository, 'js/import'), { recursive: true });
        await writeFile(join(repository, 'README.md'), 'base\n');
        await writeFile(join(repository, 'CHANGELOG.md'), 'base\n');
        await writeFile(join(repository, 'docs/README.md'), 'base\n');
        await writeFile(join(repository, 'js/import/escape.js'), 'rename\n');
        git(repository, ['add', '--',
            'README.md',
            'CHANGELOG.md',
            'docs/README.md',
            'js/import/escape.js'
        ]);
        git(repository, ['commit', '--quiet', '-m', 'base']);
        const base = git(repository, ['rev-parse', 'HEAD']);

        await writeFile(join(repository, 'README.md'), 'head\n');
        git(repository, ['add', '--', 'README.md']);
        git(repository, ['commit', '--quiet', '-m', 'head change']);

        await writeFile(join(repository, 'CHANGELOG.md'), 'index\n');
        git(repository, ['add', '--', 'CHANGELOG.md']);
        await writeFile(join(repository, 'docs/README.md'), 'worktree\n');

        await mkdir(join(repository, 'scripts'), { recursive: true });
        await rename(
            join(repository, 'js/import/escape.js'),
            join(repository, 'scripts/check-public-scope-freeze.mjs')
        );
        git(repository, ['add', '--',
            'js/import/escape.js',
            'scripts/check-public-scope-freeze.mjs'
        ]);

        await writeFile(join(repository, 'docs/not-listed.md'), 'untracked\n');

        const changes = listScopeFreezeChanges({ base, cwd: repository });
        assert.deepEqual(changes, [
            'CHANGELOG.md',
            'README.md',
            'docs/README.md',
            'docs/not-listed.md',
            'js/import/escape.js',
            'scripts/check-public-scope-freeze.mjs'
        ]);
        assert.deepEqual(findProhibitedScopeChanges(changes), [
            'js/import/escape.js'
        ]);
        assert.deepEqual(findUnlistedScopeChanges(changes), [
            'docs/not-listed.md',
            'js/import/escape.js'
        ]);
        assert.throws(() => listScopeFreezeChanges({
            base: '0000000000000000000000000000000000000000',
            cwd: repository
        }));
    } finally {
        await rm(repository, { recursive: true, force: true });
    }
});

test('scope freeze branch gate prefers CI head and fails closed without it', () => {
    const localBranch = () => `${PUBLIC_SCOPE_FREEZE_BRANCH}\n`;
    assert.equal(resolveScopeFreezeBranch({
        env: {},
        execFile: localBranch
    }), PUBLIC_SCOPE_FREEZE_BRANCH);
    assert.equal(isPublicScopeFreezeBranch({
        env: {},
        execFile: localBranch
    }), true);
    assert.equal(isPublicScopeFreezeBranch({
        env: {},
        execFile: () => 'other-branch\n'
    }), false);

    assert.equal(resolveScopeFreezeBranch({
        env: {
            GITHUB_ACTIONS: 'true',
            GITHUB_HEAD_REF: PUBLIC_SCOPE_FREEZE_BRANCH
        },
        execFile: () => {
            throw new Error('CI must not fall back to the local branch');
        }
    }), PUBLIC_SCOPE_FREEZE_BRANCH);
    assert.equal(isPublicScopeFreezeBranch({
        env: { GITHUB_ACTIONS: 'true' },
        execFile: localBranch
    }), false);
});

function currentTaskBranch() {
    return resolveScopeFreezeBranch({ cwd: new URL('../../', import.meta.url) });
}

test('current public scope-freeze branch satisfies the literal allowlist', {
    skip: currentTaskBranch() !== PUBLIC_SCOPE_FREEZE_BRANCH
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
