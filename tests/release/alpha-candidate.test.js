import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const VERSION = '2.0.0-alpha.1';
const RELEASE_NAME = `v${VERSION}`;
const ALLOWLIST = Object.freeze([
  '.github/workflows/ci.yml',
  'CHANGELOG.md',
  'README.md',
  'docs/README.md',
  'docs/engineering/release-gates.md',
  'docs/guides/known-limitations.md',
  'docs/tasks/pr-49-alpha-candidate-planning.md',
  'package-lock.json',
  'package.json',
  'scripts/alpha-candidate.mjs',
  'styles/gear.css',
  'tests/docs/release-docs.test.js',
  'tests/import/decoder-registry-wiring.test.js',
  'tests/privacy/external-runtime.test.js',
  'tests/release/alpha-candidate.test.js',
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

async function writeFiles(root, files) {
  for (const [path, bytes] of files) {
    const target = join(root, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

async function createSyntheticCandidate(tool, parent) {
  const sourceRoot = join(parent, 'source');
  const payload = new Map([
    ['classifyBike.js', Buffer.from('bike\n')], ['classifyRun.js', Buffer.from('run\n')],
    ['diagnostics.html', Buffer.from('diagnostics\n')], ['icon-sport.svg', Buffer.from('<svg/>\n')],
    ['index.html', Buffer.from('<!doctype html>\n')], ['manifest.json', Buffer.from('{}\n')],
    ['source-manager.html', Buffer.from('sources\n')], ['storage-backup.html', Buffer.from('backup\n')],
    ['sw.js', Buffer.from('worker\n')], ['js/vendor/THIRD_PARTY_NOTICES.md', Buffer.from('notices\n')],
    ['media/bg-bike.jpg', Buffer.from('bike-image')], ['media/bg-run.jpg', Buffer.from('run-image')],
    ['media/bg-swim.jpg', Buffer.from('swim-image')],
  ]);
  await writeFiles(sourceRoot, payload);
  await writeFile(join(sourceRoot, 'package.json'), `${JSON.stringify({
    version: VERSION, private: true, engines: { node: '24.19.0' }, packageManager: 'npm@11.17.0',
  })}\n`);
  await writeFile(join(sourceRoot, 'package-lock.json'), `${JSON.stringify({
    version: VERSION, packages: { '': { version: VERSION, engines: { node: '24.19.0' } } },
  })}\n`);
  execFileSync('git', ['init', '--quiet'], { cwd: sourceRoot });
  execFileSync('git', ['add', '--', ...payload.keys(), 'package.json', 'package-lock.json'], { cwd: sourceRoot });
  execFileSync('git', [
    '-c', 'user.name=Alpha Test', '-c', 'user.email=alpha@example.invalid',
    'commit', '--quiet', '-m', 'synthetic candidate',
  ], { cwd: sourceRoot });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
  const sourceDateEpoch = Number(execFileSync(
    'git', ['show', '-s', '--format=%ct', commit], { cwd: sourceRoot, encoding: 'utf8' },
  ).trim());
  const files = new Map(payload);
  files.set('PROVENANCE.json', tool.createProvenanceBytes({ commit, tree, sourceDateEpoch }));
  files.set('SHA256SUMS', tool.createSha256SumsBytes(files));
  const bundleRoot = join(parent, 'stravastats-v2.0.0-alpha.1');
  await writeFiles(bundleRoot, files);
  const container = join(parent, 'stravastats-v2.0.0-alpha.1.zip');
  const containerBytes = tool.createStoredZipBytes(files);
  await writeFile(container, containerBytes);
  const evidence = join(parent, 'stravastats-v2.0.0-alpha.1.evidence.json');
  await writeFile(evidence, tool.createEvidenceBytes({
    commit, tree,
    manifestSha256: createHash('sha256').update(files.get('SHA256SUMS')).digest('hex'),
    containerSha256: createHash('sha256').update(containerBytes).digest('hex'),
  }));
  return { bundleRoot, container, evidence, files, sourceRoot, commit, tree };
}

function localRequest(port, path, { method = 'GET', host = `127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers: { Host: host } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('A3 freezes the exact fifteen-path hard maximum', async () => {
  const brief = await source('docs/tasks/pr-49-alpha-candidate-planning.md');
  const match = /### Frozen literal cumulative implementation allowlist[\s\S]*?```text\n([\s\S]*?)\n```/.exec(brief);
  assert.notEqual(match, null);
  assert.deepEqual(match[1].split('\n'), ALLOWLIST);
  assert.match(brief, /fifteen-path literal cumulative hard maximum/i);
  assert.match(brief, /sixteenth path[\s\S]{0,120}(?:stops|stop)/i);
  assert.match(brief, /test-only[\s\S]{0,160}whole-file SHA-256 collision/i);
  assert.match(brief, /test-only fifteenth[\s\S]{0,180}R11 whole-file guard/i);
});

test('package and lock root metadata bind the Alpha SemVer and exact toolchain', async () => {
  const pkg = JSON.parse(await source('package.json'));
  const lock = JSON.parse(await source('package-lock.json'));
  assert.equal(pkg.version, VERSION);
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.engines, { node: '24.19.0' });
  assert.equal(pkg.packageManager, 'npm@11.17.0');
  assert.equal(lock.version, VERSION);
  assert.equal(lock.packages[''].version, VERSION);
  assert.deepEqual(lock.packages[''].engines, { node: '24.19.0' });
  assert.equal(Object.hasOwn(lock.packages[''], 'packageManager'), false);
  assert.equal(lock.packages[''].dependencies['@vercel/speed-insights'], '^2.0.0');
  assert.equal(lock.packages[''].dependencies['node-fetch'], '^2.6.7');
  assert.equal(lock.packages[''].devDependencies.fakeindexeddb, undefined);
  assert.equal(lock.packages[''].devDependencies['fake-indexeddb'], '^6.2.5');
  for (const name of ['build:alpha-candidate', 'verify:alpha-candidate', 'serve:alpha-candidate']) {
    assert.match(pkg.scripts[name], /^node scripts\/alpha-candidate\.mjs --/);
  }
});

test('candidate tool exports the frozen build verify and loopback boundaries', async () => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?red=${Date.now()}`);
  for (const name of [
    'selectPayloadPaths', 'createProvenanceBytes', 'createSha256SumsBytes',
    'createEvidenceBytes', 'createStoredZipBytes', 'auditStoredZip32Bytes',
    'verifyCandidate', 'buildCandidate', 'createStaticServer', 'assertAuthorizedBranch',
    'assertEmptyExternalParent',
  ]) assert.equal(typeof tool[name], 'function', name);
  assert.equal(tool.ALPHA_VERSION, VERSION);
  assert.equal(tool.ALPHA_RELEASE_NAME, RELEASE_NAME);
  assert.equal(tool.REQUIRED_NODE_VERSION, 'v24.19.0');
  assert.equal(tool.REQUIRED_NPM_VERSION, '11.17.0');
  assert.equal(tool.AUTHORIZED_BRANCH, 'codex/v2/release-head-verification');
  assert.equal(tool.AUTHORIZED_BASE_BRANCH, 'integration/v2');
  assert.equal(tool.AUTHORIZED_BASE_SHA, '57c2cdf9358afef1330d5a71f3799f18d41f6d13');
  assert.equal(tool.AUTHORIZED_PR_NUMBER, 62);
  assert.equal(tool.AUTHORIZED_REPOSITORY, 'XiChuan9/StravaStats');
  assert.doesNotMatch(await source('scripts/alpha-candidate.mjs'), /enforceToolchain/);
});

test('PR 62 exact-candidate CI schedules broadly, authenticates first, and cannot skip its build', async () => {
  const workflow = await source('.github/workflows/ci.yml');
  const job = /  exact-alpha-candidate:\n([\s\S]*)$/.exec(workflow)?.[1];
  assert.notEqual(job, undefined);
  assert.match(job, /^    needs: checks$/m);
  assert.doesNotMatch(job, /continue-on-error|upload-artifact/);
  const selector = /    if: >-\n([\s\S]*?)    runs-on:/.exec(job)?.[1];
  assert.match(selector, /github\.event_name == 'pull_request'/);
  assert.match(selector, /github\.event\.number == 62/);
  assert.match(selector, /github\.repository == 'XiChuan9\/StravaStats'/);
  assert.doesNotMatch(selector, /head_ref|base_ref|draft|base\.sha/);
  const eventAssertion = job.indexOf('- name: Authenticate exact Draft PR 62 event');
  const checkout = job.indexOf('- name: Check out exact candidate head');
  const sourceAssertion = job.indexOf('- name: Authenticate checked-out exact candidate SHA');
  const build = job.indexOf('- name: Build, authenticate, and compare exact Alpha candidate');
  assert.equal(eventAssertion >= 0 && eventAssertion < checkout && checkout < sourceAssertion && sourceAssertion < build, true);
  for (const value of [
    '.number == 62', '.pull_request.state == "open"', '.pull_request.draft == true',
    '.pull_request.head.ref == "codex/v2/release-head-verification"',
    '.pull_request.head.repo.full_name == "XiChuan9/StravaStats"',
    '.pull_request.base.ref == "integration/v2"',
    '.pull_request.base.sha == "57c2cdf9358afef1330d5a71f3799f18d41f6d13"',
    '.pull_request.base.repo.full_name == "XiChuan9/StravaStats"',
  ]) assert.match(job, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(job, /assertAuthorizedBranch/);
  const candidateStep = job.slice(build);
  assert.doesNotMatch(candidateStep, /^\s+if:/m);
  assert.match(job, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(job, /fetch-depth: 1/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /node-version: 24\.19\.0/);
  assert.match(job, /npm install --global npm@11\.17\.0/);
  assert.match(job, /git symbolic-ref --quiet --short HEAD \|\| true/);
  assert.match(job, /git rev-parse --is-shallow-repository/);
  assert.match(job, /git rev-list --count HEAD/);
  assert.match(job, /git status --porcelain=v1 --untracked-files=all/);
  assert.equal([...candidateStep.matchAll(/npm run build:alpha-candidate/g)].length, 2);
  assert.equal([...candidateStep.matchAll(/npm run verify:alpha-candidate/g)].length, 2);
  assert.match(candidateStep, /cmp "\$first\/\$root\.zip" "\$second\/\$root\.zip"/);
  assert.match(candidateStep, /cmp "\$first\/\$root\.evidence\.json" "\$second\/\$root\.evidence\.json"/);
  assert.match(candidateStep, /diff --recursive --brief "\$first\/\$root" "\$second\/\$root"/);
  assert.match(candidateStep, /sha256sum "\$first\/\$root\/SHA256SUMS" "\$first\/\$root\.zip" "\$first\/\$root\.evidence\.json"/);
});

test('build authority authenticates the exact local remote head or exact Draft PR 62 event', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?branch=${Date.now()}`);
  const root = await mkdtemp(join(tmpdir(), 'stravastats-alpha-branch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet', '--initial-branch=arbitrary'], { cwd: root });
  await writeFile(join(root, 'sentinel'), 'branch\n');
  execFileSync('git', ['add', 'sentinel'], { cwd: root });
  execFileSync('git', [
    '-c', 'user.name=Alpha Test', '-c', 'user.email=alpha@example.invalid',
    'commit', '--quiet', '-m', 'branch guard',
  ], { cwd: root });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.throws(() => tool.assertAuthorizedBranch({ cwd: root, commit, env: {} }), /AUTHORIZED_BRANCH_REQUIRED/);
  execFileSync('git', ['remote', 'add', 'origin', tool.SOURCE_REPOSITORY], { cwd: root });
  execFileSync('git', ['update-ref', `refs/remotes/origin/${tool.AUTHORIZED_BRANCH}`, commit], { cwd: root });
  execFileSync('git', ['checkout', '--quiet', '-b', tool.AUTHORIZED_BRANCH], { cwd: root });
  assert.throws(() => tool.assertAuthorizedBranch({ cwd: root, commit, env: {} }), /AUTHORIZED_HEAD_REQUIRED/);
  assert.throws(() => tool.assertAuthorizedBranch({
    cwd: root, commit, env: { ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit },
  }), /AUTHORIZED_REMOTE_HEAD_REQUIRED/);
  execFileSync('git', ['branch', '--set-upstream-to', `origin/${tool.AUTHORIZED_BRANCH}`], { cwd: root });
  assert.doesNotThrow(() => tool.assertAuthorizedBranch({
    cwd: root, commit, env: { ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit },
  }));
  assert.throws(() => tool.assertAuthorizedBranch({
    cwd: root, commit: '0'.repeat(40), env: { ALPHA_CANDIDATE_AUTHORIZED_HEAD: '0'.repeat(40) },
  }), /AUTHORIZED_HEAD_MISMATCH/);
  execFileSync('git', ['update-ref', '-d', `refs/remotes/origin/${tool.AUTHORIZED_BRANCH}`], { cwd: root });
  assert.throws(() => tool.assertAuthorizedBranch({
    cwd: root, commit, env: { ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit },
  }), /AUTHORIZED_REMOTE_HEAD_REQUIRED/);
  execFileSync('git', ['update-ref', `refs/remotes/origin/${tool.AUTHORIZED_BRANCH}`, commit], { cwd: root });
  execFileSync('git', ['update-ref', 'refs/remotes/origin/other', commit], { cwd: root });
  execFileSync('git', ['branch', '--set-upstream-to', 'origin/other'], { cwd: root });
  assert.throws(() => tool.assertAuthorizedBranch({
    cwd: root, commit, env: { ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit },
  }), /AUTHORIZED_REMOTE_HEAD_REQUIRED/);
  execFileSync('git', ['branch', '--set-upstream-to', `origin/${tool.AUTHORIZED_BRANCH}`], { cwd: root });
  execFileSync('git', ['remote', 'set-url', 'origin', 'https://github.com/attacker/fork.git'], { cwd: root });
  assert.throws(() => tool.assertAuthorizedBranch({
    cwd: root, commit, env: { ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit },
  }), /AUTHORIZED_REPOSITORY_REQUIRED/);
  execFileSync('git', ['remote', 'set-url', 'origin', tool.SOURCE_REPOSITORY], { cwd: root });
  execFileSync('git', ['checkout', '--quiet', '--detach', commit], { cwd: root });
  const eventPath = join(root, 'event.json');
  const event = {
    number: tool.AUTHORIZED_PR_NUMBER,
    repository: { full_name: tool.AUTHORIZED_REPOSITORY },
    pull_request: {
      state: 'open', draft: true,
      head: { ref: tool.AUTHORIZED_BRANCH, sha: commit, repo: { full_name: tool.AUTHORIZED_REPOSITORY } },
      base: {
        ref: tool.AUTHORIZED_BASE_BRANCH, sha: tool.AUTHORIZED_BASE_SHA,
        repo: { full_name: tool.AUTHORIZED_REPOSITORY },
      },
    },
  };
  const env = {
    GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_HEAD_REF: tool.AUTHORIZED_BRANCH, GITHUB_BASE_REF: tool.AUTHORIZED_BASE_BRANCH,
    GITHUB_REPOSITORY: tool.AUTHORIZED_REPOSITORY,
    ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit, GITHUB_EVENT_PATH: eventPath,
  };
  await writeFile(eventPath, JSON.stringify(event));
  assert.doesNotThrow(() => tool.assertAuthorizedBranch({ cwd: root, commit, env }));

  const mutations = [
    ['number', value => { value.number = 61; }],
    ['repository', value => { value.repository.full_name = 'attacker/fork'; }],
    ['state', value => { value.pull_request.state = 'closed'; }],
    ['draft', value => { value.pull_request.draft = false; }],
    ['head ref', value => { value.pull_request.head.ref = 'other'; }],
    ['head sha', value => { value.pull_request.head.sha = '0'.repeat(40); }],
    ['head repo', value => { value.pull_request.head.repo.full_name = 'attacker/fork'; }],
    ['base ref', value => { value.pull_request.base.ref = 'main'; }],
    ['base sha', value => { value.pull_request.base.sha = '0'.repeat(40); }],
    ['base repo', value => { value.pull_request.base.repo.full_name = 'attacker/fork'; }],
  ];
  for (const [label, mutate] of mutations) {
    const changed = structuredClone(event);
    mutate(changed);
    await writeFile(eventPath, JSON.stringify(changed));
    assert.throws(() => tool.assertAuthorizedBranch({ cwd: root, commit, env }), /AUTHORIZED_BRANCH_REQUIRED/, label);
  }
  await writeFile(eventPath, JSON.stringify(event));
  for (const [label, changedEnv] of [
    ['actions', { GITHUB_ACTIONS: 'false' }],
    ['event', { GITHUB_EVENT_NAME: 'push' }],
    ['head label', { GITHUB_HEAD_REF: 'other' }],
    ['base label', { GITHUB_BASE_REF: 'main' }],
    ['repository label', { GITHUB_REPOSITORY: 'attacker/fork' }],
    ['authorized SHA', { ALPHA_CANDIDATE_AUTHORIZED_HEAD: '0'.repeat(40) }],
  ]) assert.throws(
    () => tool.assertAuthorizedBranch({ cwd: root, commit, env: { ...env, ...changedEnv } }),
    /AUTHORIZED_BRANCH_REQUIRED/, label,
  );
  execFileSync('git', ['checkout', '--quiet', tool.AUTHORIZED_BRANCH], { cwd: root });
  assert.throws(() => tool.assertAuthorizedBranch({ cwd: root, commit, env }), /AUTHORIZED_ACTIONS_DETACHED_HEAD_REQUIRED/);
});

test('external output containment rejects repository aliases and symlink output parents', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?output=${Date.now()}`);
  const root = await mkdtemp(join(tmpdir(), 'stravastats-alpha-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const outside = join(root, 'outside');
  const outsideTarget = join(root, 'outside-target');
  await Promise.all([mkdir(repo), mkdir(outside), mkdir(outsideTarget)]);
  execFileSync('git', ['init', '--quiet', '--initial-branch=arbitrary'], { cwd: repo });
  assert.equal(await tool.assertEmptyExternalParent(outside, repo), await realpath(outside));

  const inside = join(repo, 'candidate');
  await mkdir(inside);
  const subdirectory = join(repo, 'nested');
  await mkdir(subdirectory);
  await assert.rejects(
    tool.assertEmptyExternalParent(inside, subdirectory), /OUTPUT_INSIDE_REPOSITORY/,
  );
  const alias = join(root, 'repo-alias');
  await symlink(repo, alias);
  await assert.rejects(tool.assertEmptyExternalParent(join(alias, 'candidate'), repo), /OUTPUT_INSIDE_REPOSITORY/);

  const outputSymlink = join(root, 'output-symlink');
  await symlink(outsideTarget, outputSymlink);
  await assert.rejects(tool.assertEmptyExternalParent(outputSymlink, repo), /OUTPUT_PARENT_NOT_DIRECTORY/);
  await writeFile(join(outside, 'sentinel'), 'preserve');
  await assert.rejects(tool.assertEmptyExternalParent(outside, repo), /OUTPUT_PARENT_NOT_EMPTY/);
});

test('G1 selector derives the current exact tracked regular payload', async () => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?selector=${Date.now()}`);
  const records = execFileSync('git', ['ls-tree', '-rz', '--full-tree', 'HEAD'])
    .toString('utf8').split('\0').filter(Boolean).map(line => {
      const [metadata, path] = line.split('\t');
      const [mode, type, object] = metadata.split(' ');
      return { mode, type, object, path };
    });
  const selected = tool.selectPayloadPaths(records);
  assert.equal(selected.length, 209);
  assert.equal(selected[0].path, 'classifyBike.js');
  assert.equal(selected.at(-1).path, 'sw.js');
  assert.equal(selected.every(item => item.mode === '100644' && item.type === 'blob'), true);
  assert.equal(selected.some(item => item.path.startsWith('api/')), false);
  assert.equal(selected.some(item => item.path === 'package.json'), false);
});

test('approved CSS repair removes the missing Dashboard image request only', async () => {
  const css = await source('styles/gear.css');
  assert.doesNotMatch(css, /bg-dashboard\.jpg/);
  for (const path of ['bg-run.jpg', 'bg-bike.jpg', 'bg-swim.jpg']) {
    assert.match(css, new RegExp(path.replace('.', '\\.')));
  }
});

test('provenance and manifest bytes are canonical, acyclic, and deterministic', async () => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?metadata=${Date.now()}`);
  const provenance = tool.createProvenanceBytes({
    commit: 'a'.repeat(40), tree: 'b'.repeat(40), sourceDateEpoch: 1_700_000_000,
  });
  assert.equal(provenance.at(-1), 10);
  assert.equal(provenance.includes(13), false);
  const parsed = JSON.parse(provenance);
  assert.deepEqual(Object.keys(parsed), [
    'version', 'commit', 'tree', 'sourceRepository', 'buildCommand', 'nodeVersion',
    'npmVersion', 'sourceDateEpoch', 'payloadSelectionRuleVersion',
  ]);
  assert.equal(Object.keys(parsed).some(key => /manifest|container|digest/i.test(key)), false);

  const files = new Map([
    ['z.txt', Buffer.from('z')], ['a.txt', Buffer.from('a')],
    ['PROVENANCE.json', provenance],
  ]);
  const manifest = tool.createSha256SumsBytes(files).toString('utf8');
  assert.equal(manifest.endsWith('\n'), true);
  assert.equal(manifest.includes('\r'), false);
  assert.deepEqual(manifest.trimEnd().split('\n').map(row => row.slice(66)), [
    'PROVENANCE.json', 'a.txt', 'z.txt',
  ]);
  assert.equal(manifest.includes('SHA256SUMS'), false);
  const evidence = tool.createEvidenceBytes({
    commit: 'a'.repeat(40), tree: 'b'.repeat(40),
    manifestSha256: 'c'.repeat(64), containerSha256: 'd'.repeat(64),
  });
  assert.equal(evidence.at(-1), 10);
  assert.deepEqual(Object.keys(JSON.parse(evidence)), [
    'version', 'commit', 'tree', 'manifestFile', 'manifestSha256', 'containerFile', 'containerSha256',
  ]);
  assert.throws(() => tool.createEvidenceBytes({
    commit: 'a'.repeat(40), tree: 'b'.repeat(40),
    manifestSha256: 'C'.repeat(64), containerSha256: 'd'.repeat(64),
  }), /EVIDENCE_VALUE_INVALID/);
});

test('stored ZIP32 bytes use the frozen deterministic entry profile', async () => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?zip=${Date.now()}`);
  const files = new Map([
    ['PROVENANCE.json', Buffer.from('{}\n')],
    ['index.html', Buffer.from('<!doctype html>\n')],
  ]);
  const first = tool.createStoredZipBytes(files);
  const second = tool.createStoredZipBytes(new Map([...files].reverse()));
  assert.deepEqual(first, second);
  assert.deepEqual(tool.auditStoredZip32Bytes(first, files), {
    entryCount: 2, paths: ['PROVENANCE.json', 'index.html'],
  });
  const firstNameLength = first.readUInt16LE(26);
  const firstData = 30 + firstNameLength;
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt16LE(4), 10);
  assert.equal(first.readUInt16LE(6), 0x0800);
  assert.equal(first.readUInt16LE(8), 0);
  assert.equal(first.readUInt16LE(10), 0);
  assert.equal(first.readUInt16LE(12), 0x0021);
  assert.equal(first.readUInt32LE(14), 0xdda1b006); // known CRC-32 of "{}\n"
  assert.equal(first.readUInt32LE(18), 3);
  assert.equal(first.readUInt32LE(22), 3);
  assert.equal(first.readUInt16LE(28), 0);
  assert.deepEqual(first.subarray(firstData, firstData + 3), Buffer.from('{}\n'));
  assert.match(first.toString('utf8'), /stravastats-v2\.0\.0-alpha\.1\/index\.html/);
  assert.doesNotMatch(first.toString('utf8'), /stravastats-v2\.0\.0-alpha\.1\/$/m);

  const mutations = [
    ['local signature', 0], ['local version', 4], ['local flags', 6],
    ['local method', 8], ['local time', 10], ['local date', 12], ['local crc', 14],
    ['local compressed size', 18], ['local size', 22], ['local name length', 26],
    ['local extra length', 28], ['local name', 30], ['local data', firstData],
  ];
  const eocd = first.length - 22;
  const central = first.readUInt32LE(eocd + 16);
  mutations.push(
    ['central signature', central], ['central made-by', central + 4],
    ['central version', central + 6], ['central flags', central + 8],
    ['central method', central + 10], ['central time', central + 12],
    ['central date', central + 14], ['central crc', central + 16],
    ['central compressed size', central + 20], ['central size', central + 24],
    ['central name length', central + 28], ['central extra length', central + 30],
    ['central comment length', central + 32], ['central disk', central + 34],
    ['central internal attrs', central + 36], ['central attrs', central + 38],
    ['central offset', central + 42],
    ['central name', central + 46], ['eocd signature', eocd], ['eocd disk', eocd + 4],
    ['eocd central disk', eocd + 6], ['eocd disk count', eocd + 8],
    ['eocd total count', eocd + 10], ['eocd size', eocd + 12],
    ['eocd offset', eocd + 16], ['eocd comment', eocd + 20],
  );
  for (const [label, offset] of mutations) {
    const changed = Buffer.from(first);
    changed[offset] ^= 1;
    assert.throws(() => tool.auditStoredZip32Bytes(changed, files), /CONTAINER_PROFILE/, label);
  }
  assert.throws(() => tool.auditStoredZip32Bytes(Buffer.concat([first, Buffer.from('append')]), files), /CONTAINER_PROFILE/);
  assert.throws(() => tool.auditStoredZip32Bytes(first, new Map([...files].reverse().slice(1))), /CONTAINER_PROFILE/);
  assert.throws(() => tool.createStoredZipBytes(new Map([['directory/', Buffer.alloc(0)]])), /ZIP_INPUT_INVALID/);
  assert.throws(() => tool.auditStoredZip32Bytes(first, new Map([['directory/', Buffer.alloc(0)]])), /CONTAINER_PROFILE/);
});

test('candidate verification rejects extra files, payload tampering, and ZIP corruption', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?verify=${Date.now()}`);
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-verify-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const { bundleRoot, container, evidence, files, sourceRoot } = await createSyntheticCandidate(tool, parent);
  const zip = await readFile(container);
  const canonicalEvidence = await readFile(evidence);
  const verified = await tool.verifyCandidate({ bundleRoot, container, cwd: sourceRoot });
  assert.equal(verified.fileCount, 15);
  assert.equal(verified.selectedFileCount, 13);
  assert.equal(verified.manifestSha256, createHash('sha256').update(files.get('SHA256SUMS')).digest('hex'));
  assert.equal(verified.containerSha256, createHash('sha256').update(zip).digest('hex'));
  assert.equal(verified.evidenceSha256, createHash('sha256').update(await readFile(evidence)).digest('hex'));
  assert.equal(Number.isSafeInteger(verified.sourceDateEpoch), true);

  const rootAlias = join(parent, 'bundle-root-alias');
  await symlink(bundleRoot, rootAlias);
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot: rootAlias, container, evidence, cwd: sourceRoot }),
    /BUNDLE_ROOT_REQUIRED/,
  );
  const evidenceTarget = join(parent, 'evidence-target.json');
  await writeFile(evidenceTarget, canonicalEvidence);
  await rm(evidence);
  await symlink(evidenceTarget, evidence);
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }), /EVIDENCE_FILE_REQUIRED/,
  );
  await rm(evidence);
  await writeFile(evidence, canonicalEvidence);
  const renamedEvidence = join(parent, 'renamed.evidence.json');
  await rename(evidence, renamedEvidence);
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container, cwd: sourceRoot }), /EVIDENCE_FILE_REQUIRED/,
  );
  await rename(renamedEvidence, evidence);

  await writeFile(join(bundleRoot, 'extra.txt'), 'extra');
  await assert.rejects(tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }), /BUNDLE_FILE_SET/);
  await rm(join(bundleRoot, 'extra.txt'));
  await writeFile(join(bundleRoot, 'index.html'), 'tampered');
  await assert.rejects(tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }), /BUNDLE_HASH/);
  await writeFile(join(bundleRoot, 'index.html'), files.get('index.html'));
  const corrupt = Buffer.from(zip);
  corrupt[corrupt.length - 1] ^= 1;
  await writeFile(container, corrupt);
  await assert.rejects(tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }), /CONTAINER_PROFILE/);
  await writeFile(container, zip);

  for (const [label, tampered] of [
    ['grammar', Buffer.from('{')],
    ['schema order', Buffer.from(`${JSON.stringify(Object.fromEntries(
      Object.entries(JSON.parse(canonicalEvidence)).reverse(),
    ))}\n`)],
    ['digest', Buffer.from(`${JSON.stringify({
      ...JSON.parse(canonicalEvidence), containerSha256: '0'.repeat(64),
    })}\n`)],
    ['extra key', Buffer.from(`${JSON.stringify({ ...JSON.parse(canonicalEvidence), extra: true })}\n`)],
  ]) {
    await writeFile(evidence, tampered);
    await assert.rejects(
      tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }),
      /EVIDENCE_(?:GRAMMAR|SCHEMA|AUTHENTICATION)/, label,
    );
  }
  const evidenceValues = {
    version: 'v0.0.0', commit: '1'.repeat(40), tree: '2'.repeat(40),
    manifestFile: 'wrong/SHA256SUMS', manifestSha256: '3'.repeat(64),
    containerFile: 'wrong.zip', containerSha256: '4'.repeat(64),
  };
  for (const key of Object.keys(evidenceValues)) {
    const changed = { ...JSON.parse(canonicalEvidence), [key]: evidenceValues[key] };
    await writeFile(evidence, `${JSON.stringify(changed)}\n`);
    await assert.rejects(
      tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }),
      /EVIDENCE_AUTHENTICATION/, key,
    );
  }
  await writeFile(evidence, canonicalEvidence);
  await rm(evidence);
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }),
    /EVIDENCE_FILE_REQUIRED/, 'missing evidence',
  );
});

test('strict verification reports malformed manifested provenance deterministically', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?grammar=${Date.now()}`);
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-grammar-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const { bundleRoot, container, evidence, files, sourceRoot } = await createSyntheticCandidate(tool, parent);
  files.set('PROVENANCE.json', Buffer.from('{'));
  files.set('SHA256SUMS', tool.createSha256SumsBytes(new Map(
    [...files].filter(([path]) => path !== 'SHA256SUMS'),
  )));
  await writeFile(join(bundleRoot, 'PROVENANCE.json'), files.get('PROVENANCE.json'));
  await writeFile(join(bundleRoot, 'SHA256SUMS'), files.get('SHA256SUMS'));
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }), /PROVENANCE_GRAMMAR/,
  );
  files.set('PROVENANCE.json', Buffer.from('null\n'));
  files.set('SHA256SUMS', tool.createSha256SumsBytes(new Map(
    [...files].filter(([path]) => path !== 'SHA256SUMS'),
  )));
  await writeFile(join(bundleRoot, 'PROVENANCE.json'), files.get('PROVENANCE.json'));
  await writeFile(join(bundleRoot, 'SHA256SUMS'), files.get('SHA256SUMS'));
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container, evidence, cwd: sourceRoot }), /PROVENANCE_VERSION/,
  );
});

test('loopback static server serves only manifest-listed files and rejects unsafe requests', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?server=${Date.now()}`);
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-server-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const bundleRoot = join(parent, 'bundle');
  const files = new Map([
    ['index.html', Buffer.from('<!doctype html>alpha\n')],
    ['source-manager.html', Buffer.from('<!doctype html>sources\n')],
    ['PROVENANCE.json', Buffer.from('{}\n')],
  ]);
  files.set('SHA256SUMS', tool.createSha256SumsBytes(files));
  await writeFiles(bundleRoot, files);
  await writeFile(join(bundleRoot, 'unlisted.txt'), 'not served');
  const server = tool.createStaticServer({ bundleRoot });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  const root = await localRequest(port, '/');
  assert.equal(root.status, 200);
  assert.equal(root.headers['cache-control'], 'no-store');
  assert.match(root.body.toString('utf8'), /alpha/);
  assert.equal((await localRequest(port, '/', { method: 'HEAD' })).body.length, 0);
  assert.equal((await localRequest(port, '/api/token')).status, 403);
  assert.equal((await localRequest(port, '/source-manager.html?mode=real')).status, 200);
  assert.equal((await localRequest(port, '/?enable-sw=1')).status, 403);
  assert.equal((await localRequest(port, '/%2e%2e/index.html')).status, 403);
  assert.equal((await localRequest(port, '/unlisted.txt')).status, 404);
  assert.equal((await localRequest(port, '/', { host: 'example.com' })).status, 403);
  assert.equal((await localRequest(port, '/.git/config')).status, 404);
});

test('strict verification rejects a self-consistent non-candidate bundle', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?strict=${Date.now()}`);
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-fake-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const bundleRoot = join(parent, 'stravastats-v2.0.0-alpha.1');
  const files = new Map([
    ['PROVENANCE.json', tool.createProvenanceBytes({
      commit: 'e'.repeat(40), tree: 'f'.repeat(40), sourceDateEpoch: 1_700_000_002,
    })],
    ['index.html', Buffer.from('<!doctype html>fake\n')],
  ]);
  files.set('SHA256SUMS', tool.createSha256SumsBytes(files));
  await writeFiles(bundleRoot, files);
  const container = join(parent, 'stravastats-v2.0.0-alpha.1.zip');
  const containerBytes = tool.createStoredZipBytes(files);
  await writeFile(container, containerBytes);
  await writeFile(join(parent, 'stravastats-v2.0.0-alpha.1.evidence.json'), tool.createEvidenceBytes({
    commit: 'e'.repeat(40), tree: 'f'.repeat(40),
    manifestSha256: createHash('sha256').update(files.get('SHA256SUMS')).digest('hex'),
    containerSha256: createHash('sha256').update(containerBytes).digest('hex'),
  }));
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container }),
    /(?:PROVENANCE|CANDIDATE_SOURCE|PAYLOAD)_/,
  );
});

test('exact pinned toolchain builds reproducibly and refuses nonempty output', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?build=${Date.now()}`);
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-build-a-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  if (process.version !== 'v24.19.0' || npmVersion !== '11.17.0') {
    await assert.rejects(
      tool.buildCandidate({ outputParent: parent, cwd: process.cwd(), enforceToolchain: false }),
      /(?:NODE|NPM)_VERSION_REQUIRED/,
    );
    assert.throws(() => execFileSync(process.execPath, [
      'scripts/alpha-candidate.mjs', '--', 'build', '--output-parent', parent,
    ], { encoding: 'utf8', stdio: 'pipe' }), /(?:NODE|NPM)_VERSION_REQUIRED/);
    assert.deepEqual(await import('node:fs/promises').then(fs => fs.readdir(parent)), []);
    return;
  }

  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  let authorized = true;
  try { tool.assertAuthorizedBranch({ commit: head }); } catch { authorized = false; }
  const dirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
  }) !== '';
  if (dirty || !authorized) {
    assert.throws(() => execFileSync(process.execPath, [
      'scripts/alpha-candidate.mjs', '--', 'build', '--output-parent', parent,
    ], { encoding: 'utf8', stdio: 'pipe' }), dirty
      ? /WORKTREE_NOT_CLEAN/
      : /AUTHORIZED_(?:BRANCH|HEAD|HEAD_MISMATCH|REPOSITORY|REMOTE|ACTIONS)/);
    assert.deepEqual(await import('node:fs/promises').then(fs => fs.readdir(parent)), []);
    return;
  }

  const second = await mkdtemp(join(tmpdir(), 'stravastats-alpha-build-b-'));
  const refused = await mkdtemp(join(tmpdir(), 'stravastats-alpha-build-refused-'));
  t.after(() => Promise.all([
    rm(second, { recursive: true, force: true }),
    rm(refused, { recursive: true, force: true }),
  ]));
  const runBuild = outputParent => execFileSync('npm', [
    'run', 'build:alpha-candidate', '--', '--output-parent', outputParent,
  ], { encoding: 'utf8' });
  runBuild(parent);
  runBuild(second);
  const rootName = 'stravastats-v2.0.0-alpha.1';
  const zipName = `${rootName}.zip`;
  const evidenceName = `${rootName}.evidence.json`;
  assert.deepEqual(await readFile(join(parent, zipName)), await readFile(join(second, zipName)));
  assert.deepEqual(await readFile(join(parent, evidenceName)), await readFile(join(second, evidenceName)));
  assert.deepEqual(
    await readFile(join(parent, rootName, 'PROVENANCE.json')),
    await readFile(join(second, rootName, 'PROVENANCE.json')),
  );
  assert.deepEqual(
    await readFile(join(parent, rootName, 'SHA256SUMS')),
    await readFile(join(second, rootName, 'SHA256SUMS')),
  );
  execFileSync('npm', [
    'run', 'verify:alpha-candidate', '--', '--bundle-root', join(parent, rootName),
    '--container', join(parent, zipName),
  ], { encoding: 'utf8' });

  await writeFile(join(refused, 'sentinel'), 'preserve');
  assert.throws(() => runBuild(refused), /OUTPUT_PARENT_NOT_EMPTY/);
  assert.equal(await readFile(join(refused, 'sentinel'), 'utf8'), 'preserve');
});
