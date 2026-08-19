import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const VERSION = '2.0.0-alpha.1';
const RELEASE_NAME = `v${VERSION}`;
const RETIRED_ROUTE = ['/run', 'plus'].join('-');
const RETIRED_NESTED_ROUTE = `${RETIRED_ROUTE}/${['n', 'sm'].join('')}`;
const RETIRED_TAB_SCRIPT = ['js/tabs/run', 'plus.js'].join('-');
const RETIRED_TAB_STYLE = ['styles/run', 'plus.css'].join('-');
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
  await writeFile(container, tool.createStoredZipBytes(files));
  return { bundleRoot, container, files, sourceRoot };
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
    'createStoredZipBytes', 'verifyCandidate', 'buildCandidate', 'createStaticServer',
    'assertAuthorizedBranch',
  ]) assert.equal(typeof tool[name], 'function', name);
  assert.equal(tool.ALPHA_VERSION, VERSION);
  assert.equal(tool.ALPHA_RELEASE_NAME, RELEASE_NAME);
  assert.equal(tool.REQUIRED_NODE_VERSION, 'v24.19.0');
  assert.equal(tool.REQUIRED_NPM_VERSION, '11.17.0');
  assert.equal(tool.AUTHORIZED_BRANCH, 'codex/v2/alpha-candidate-planning');
});

test('build authority accepts only the exact branch or trusted Actions PR head', async t => {
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
  execFileSync('git', ['checkout', '--quiet', '--detach', commit], { cwd: root });
  assert.throws(() => tool.assertAuthorizedBranch({ cwd: root, commit, env: {
    GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push',
    GITHUB_HEAD_REF: tool.AUTHORIZED_BRANCH, ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit,
  } }), /AUTHORIZED_BRANCH_REQUIRED/);
  assert.throws(() => tool.assertAuthorizedBranch({ cwd: root, commit, env: {
    GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_HEAD_REF: tool.AUTHORIZED_BRANCH, ALPHA_CANDIDATE_AUTHORIZED_HEAD: '0'.repeat(40),
  } }), /AUTHORIZED_BRANCH_REQUIRED/);
  assert.doesNotThrow(() => tool.assertAuthorizedBranch({ cwd: root, commit, env: {
    GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_HEAD_REF: tool.AUTHORIZED_BRANCH, ALPHA_CANDIDATE_AUTHORIZED_HEAD: commit,
  } }));
  execFileSync('git', ['checkout', '--quiet', '-b', tool.AUTHORIZED_BRANCH], { cwd: root });
  assert.doesNotThrow(() => tool.assertAuthorizedBranch({ cwd: root, commit, env: {} }));
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
  assert.equal(selected.length, 210);
  assert.equal(selected[0].path, 'classifyBike.js');
  assert.equal(selected.at(-1).path, 'sw.js');
  assert.equal(selected.every(item => item.mode === '100644' && item.type === 'blob'), true);
  assert.equal(selected.some(item => item.path.startsWith('api/')), false);
  assert.equal(selected.some(item => item.path === 'package.json'), false);
  assert.equal(selected.some(item => item.path === RETIRED_TAB_SCRIPT), false);
  assert.equal(selected.some(item => item.path === RETIRED_TAB_STYLE), false);
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
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt16LE(6), 0x0800);
  assert.equal(first.readUInt16LE(8), 0);
  assert.equal(first.readUInt16LE(10), 0);
  assert.equal(first.readUInt16LE(12), 0x0021);
  assert.match(first.toString('utf8'), /stravastats-v2\.0\.0-alpha\.1\/index\.html/);
  assert.doesNotMatch(first.toString('utf8'), /stravastats-v2\.0\.0-alpha\.1\/$/m);
});

test('candidate verification rejects extra files, payload tampering, and ZIP corruption', async t => {
  const tool = await import(`../../scripts/alpha-candidate.mjs?verify=${Date.now()}`);
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-verify-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const { bundleRoot, container, files, sourceRoot } = await createSyntheticCandidate(tool, parent);
  const zip = await readFile(container);
  const verified = await tool.verifyCandidate({ bundleRoot, container, cwd: sourceRoot });
  assert.equal(verified.fileCount, 15);

  await writeFile(join(bundleRoot, 'extra.txt'), 'extra');
  await assert.rejects(tool.verifyCandidate({ bundleRoot, container, cwd: sourceRoot }), /BUNDLE_FILE_SET/);
  await rm(join(bundleRoot, 'extra.txt'));
  await writeFile(join(bundleRoot, 'index.html'), 'tampered');
  await assert.rejects(tool.verifyCandidate({ bundleRoot, container, cwd: sourceRoot }), /BUNDLE_HASH/);
  await writeFile(join(bundleRoot, 'index.html'), files.get('index.html'));
  const corrupt = Buffer.from(zip);
  corrupt[corrupt.length - 1] ^= 1;
  await writeFile(container, corrupt);
  await assert.rejects(tool.verifyCandidate({ bundleRoot, container, cwd: sourceRoot }), /CONTAINER_PROFILE/);
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
  assert.equal((await localRequest(port, RETIRED_ROUTE)).status, 404);
  assert.equal((await localRequest(port, RETIRED_NESTED_ROUTE)).status, 404);
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
  await writeFile(container, tool.createStoredZipBytes(files));
  await assert.rejects(
    tool.verifyCandidate({ bundleRoot, container }),
    /(?:PROVENANCE|CANDIDATE_SOURCE|PAYLOAD)_/,
  );
});

test('exact pinned toolchain builds reproducibly and refuses nonempty output', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'stravastats-alpha-build-a-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const npmVersion = /(?:^|\s)npm\/([^\s]+)/.exec(process.env.npm_config_user_agent ?? '')?.[1];
  if (process.version !== 'v24.19.0' || npmVersion !== '11.17.0') {
    assert.throws(() => execFileSync(process.execPath, [
      'scripts/alpha-candidate.mjs', '--', 'build', '--output-parent', parent,
    ], { encoding: 'utf8', stdio: 'pipe' }), /(?:NODE|NPM)_VERSION_REQUIRED/);
    assert.deepEqual(await import('node:fs/promises').then(fs => fs.readdir(parent)), []);
    return;
  }

  const branch = (() => {
    try {
      return execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch { return null; }
  })();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const authorizedActions = process.env.GITHUB_ACTIONS === 'true'
    && process.env.GITHUB_EVENT_NAME === 'pull_request'
    && process.env.GITHUB_HEAD_REF === 'codex/v2/alpha-candidate-planning'
    && process.env.ALPHA_CANDIDATE_AUTHORIZED_HEAD === head;
  if (branch !== 'codex/v2/alpha-candidate-planning' && !authorizedActions) {
    assert.throws(() => execFileSync(process.execPath, [
      'scripts/alpha-candidate.mjs', '--', 'build', '--output-parent', parent,
    ], { encoding: 'utf8', stdio: 'pipe' }), /AUTHORIZED_BRANCH_REQUIRED/);
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
