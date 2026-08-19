import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createIdentityDigest,
  findContentViolation,
  scanTrackedFiles,
} from '../../scripts/check-privacy.mjs';

test('privacy guard rejects identity selectors and numeric opaque-ID parsing', () => {
  const targetSelector = ['TARGET', 'ATHLETE', 'ID'].join('_');
  const profileAccess = ['profile', 'id'].join('.');
  const activityArgument = ['activity', 'Id'].join('');
  assert.equal(
    findContentViolation('synthetic.js', `const ${targetSelector} = 42;`),
    'hard-coded athlete identity selector',
  );
  assert.equal(
    findContentViolation('synthetic.js', `const id = Number(${profileAccess});`),
    'opaque identity numeric coercion',
  );
  assert.equal(
    findContentViolation('synthetic.js', `initialize(parseInt(${activityArgument}, 10));`),
    'opaque activity ID numeric parsing',
  );
});

test('privacy guard digest matching is testable without private literals', () => {
  const syntheticCanary = 'synthetic-private-identity-canary';
  const digests = new Set([createIdentityDigest(syntheticCanary)]);
  assert.equal(
    findContentViolation('synthetic.js', `const label = '${syntheticCanary}';`, digests),
    'tracked athlete identity literal',
  );
});

test('privacy guard rejects personal filesystem and private evidence locations', () => {
  const macOSHome = ['', 'Users', 'synthetic-user', 'Documents', 'StravaStats'].join('/');
  const codexDirectory = ['.', 'codex'].join('');
  const codexWorktree = [
    codexDirectory,
    'worktrees',
    'synthetic-id',
    'StravaStats',
  ].join('/');
  const privateEvidence = [
    ['StravaStats', 'private-data'].join('-'),
    'backups',
  ].join('/');

  assert.equal(
    findContentViolation('synthetic.md', `Repository: ${macOSHome}`),
    'personal macOS home path',
  );
  assert.equal(
    findContentViolation('synthetic.md', `Worktree: ${codexWorktree}`),
    'Codex worktree identifier path',
  );
  assert.equal(
    findContentViolation('synthetic.md', `Evidence: ${privateEvidence}`),
    'private evidence directory path',
  );
  for (const file of ['synthetic.csv', 'synthetic.svg', '.env.example']) {
    assert.equal(
      findContentViolation(file, `Repository: ${macOSHome}`),
      'personal macOS home path',
      file,
    );
  }
  const placeholderHome = ['', 'Users', '<name>', 'Documents'].join('/');
  assert.equal(
    findContentViolation('synthetic.md', `Repository: ${placeholderHome}`),
    'personal macOS home path',
  );
});

test('privacy guard permits portable repository and worktree placeholders', () => {
  for (const path of [
    '$HOME/Documents/StravaStats',
    '<repo-root>',
    '<worktree-root>/feature',
    '<private-evidence-root>',
  ]) {
    assert.equal(findContentViolation('synthetic.md', `Path: ${path}`), null, path);
  }
});

test('tracked .env.example content is checked through the scanner entry point', () => {
  const macOSHome = ['', 'Users', 'synthetic-user', 'Documents', 'StravaStats'].join('/');
  const files = new Map([
    ['.env.example', `PUBLIC_REPOSITORY_PATH=${macOSHome}`],
  ]);

  assert.deepEqual(
    scanTrackedFiles([...files.keys()], {
      readFile(file, encoding) {
        assert.equal(encoding, 'utf8');
        return files.get(file);
      },
    }),
    [{ file: '.env.example', reason: 'personal macOS home path' }],
  );
});

test('nested .env.example is rejected before tracked content is read', () => {
  let readCount = 0;

  assert.deepEqual(
    scanTrackedFiles(['config/.env.example'], {
      readFile() {
        readCount += 1;
        return '';
      },
    }),
    [{ file: 'config/.env.example', reason: 'environment file must not be tracked' }],
  );
  assert.equal(readCount, 0);
});

test('environment filename case variants are rejected before content is read', () => {
  let readCount = 0;

  assert.deepEqual(
    scanTrackedFiles(['.ENV.EXAMPLE', 'config/.Env.production'], {
      readFile() {
        readCount += 1;
        return '';
      },
    }),
    [
      { file: '.ENV.EXAMPLE', reason: 'environment file must not be tracked' },
      { file: 'config/.Env.production', reason: 'environment file must not be tracked' },
    ],
  );
  assert.equal(readCount, 0);
});

test('privacy CLI scans a tracked root .env.example in a synthetic repository', () => {
  const repository = mkdtempSync(join(tmpdir(), 'stravastats-privacy-env-'));
  const privacyScript = fileURLToPath(
    new URL('../../scripts/check-privacy.mjs', import.meta.url),
  );
  const macOSHome = ['', 'Users', 'synthetic-user', 'Documents', 'StravaStats'].join('/');

  try {
    execFileSync('git', ['init', '--quiet'], {
      cwd: repository,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    writeFileSync(
      join(repository, '.env.example'),
      `PUBLIC_REPOSITORY_PATH=${macOSHome}\n`,
      'utf8',
    );
    execFileSync('git', ['add', '--', '.env.example'], {
      cwd: repository,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    assert.throws(
      () => execFileSync(process.execPath, [privacyScript], {
        cwd: repository,
        encoding: 'utf8',
        stdio: 'pipe',
      }),
      error => {
        assert.notEqual(error.status, 0);
        assert.match(error.stderr, /personal macOS home path/);
        return true;
      },
    );
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test('opaque string IDs remain permitted as inert data', () => {
  for (const id of [
    '0',
    '000123',
    'id/a?b=c&d=e#frag%25',
    '运动员-🧪',
    '__proto__',
    'constructor',
    'prototype',
  ]) {
    assert.equal(
      findContentViolation('synthetic.js', `const id = ${JSON.stringify(id)};`),
      null,
    );
  }
});

test('tracked current tree contains no prohibited identity category', () => {
  assert.deepEqual(scanTrackedFiles(), []);
});

test('repository privacy command uses the content guard', () => {
  assert.doesNotThrow(() => execFileSync(
    process.execPath,
    ['scripts/check-privacy.mjs'],
    { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' },
  ));
});
