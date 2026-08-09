import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('Option A decision and exact nine-path hard allowlist are frozen', async () => {
  const brief = await source('docs/tasks/pr-38-service-worker-lifecycle.md');
  const expected = [
    'docs/tasks/pr-38-service-worker-lifecycle.md',
    'sw.js',
    'js/app/service-worker-policy.js',
    'js/app/main.js',
    'styles/style.css',
    'tests/service-worker-fetch-policy.test.js',
    'tests/service-worker-policy.test.js',
    'tests/service-worker-lifecycle.test.js',
    'tests/service-worker-lifecycle-browser-smoke.html',
  ];

  assert.match(brief, /owner selected \*\*Option A exactly\*\*/);
  for (const path of expected) assert.match(brief, new RegExp(path.replaceAll('.', '\\.')));
  assert.match(brief, /required tenth path[\s\S]*stops implementation/i);
});

test('production lifecycle has no immediate takeover or unknown-cache enumeration', async () => {
  const worker = await source('sw.js');

  assert.match(worker, /stravastats-static-v2-000001/);
  assert.match(worker, /strava-dashboard-v1/);
  assert.doesNotMatch(worker, /skipWaiting\s*\(/);
  assert.doesNotMatch(worker, /clients\.claim\s*\(/);
  assert.doesNotMatch(worker, /caches\.keys\s*\(/);
  assert.doesNotMatch(worker, /console\.(?:log|info|warn|error)\s*\(/);
});

test('root client exposes waiting-update copy without an activate or reload action', async () => {
  const [main, styles] = await Promise.all([
    source('js/app/main.js'),
    source('styles/style.css'),
  ]);

  assert.match(main, /service-worker-update-banner/);
  assert.match(main, /Update ready\. Close all StravaStats tabs, then reopen\./);
  assert.doesNotMatch(main, /SKIP_WAITING|ACTIVATE_UPDATE/);
  assert.doesNotMatch(main, /controllerchange[\s\S]{0,300}reload\s*\(/);
  assert.match(styles, /\.service-worker-update-banner/);
});
