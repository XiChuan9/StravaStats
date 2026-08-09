import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

function createDrainedLifecycleModel({
  clients = ['tab-a', 'tab-b'],
  cacheNames = [
    'strava-dashboard-v1',
    'stravastats-static-v2-000001',
    'unrelated-cache',
  ],
} = {}) {
  const openClients = new Map(clients.map(id => [id, Object.freeze({
    pageBuild: 'legacy',
    worker: 'legacy',
    cache: 'strava-dashboard-v1',
  })]));
  const caches = new Set(cacheNames);
  let activeWorker = 'legacy';
  let waitingWorker = 'v2-000001';

  return Object.freeze({
    snapshot() {
      return Object.freeze({
        activeWorker,
        waitingWorker,
        clients: Object.freeze([...openClients.entries()]),
        caches: Object.freeze([...caches]),
      });
    },
    close(id) {
      openClients.delete(id);
      if (openClients.size === 0 && waitingWorker !== null) {
        activeWorker = waitingWorker;
        waitingWorker = null;
      }
    },
    failInstall() {
      caches.delete('stravastats-static-v2-000001');
      waitingWorker = null;
    },
  });
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

test('two old clients stay on one old worker/cache until both drain naturally', () => {
  const model = createDrainedLifecycleModel();

  assert.deepEqual(model.snapshot(), {
    activeWorker: 'legacy',
    waitingWorker: 'v2-000001',
    clients: [
      ['tab-a', {
        pageBuild: 'legacy', worker: 'legacy', cache: 'strava-dashboard-v1',
      }],
      ['tab-b', {
        pageBuild: 'legacy', worker: 'legacy', cache: 'strava-dashboard-v1',
      }],
    ],
    caches: [
      'strava-dashboard-v1',
      'stravastats-static-v2-000001',
      'unrelated-cache',
    ],
  });

  model.close('tab-a');
  assert.equal(model.snapshot().activeWorker, 'legacy');
  assert.equal(model.snapshot().waitingWorker, 'v2-000001');
  assert.deepEqual(model.snapshot().clients.map(([id]) => id), ['tab-b']);

  model.close('tab-b');
  assert.equal(model.snapshot().activeWorker, 'v2-000001');
  assert.equal(model.snapshot().waitingWorker, null);
  assert.deepEqual(model.snapshot().clients, []);
  assert.deepEqual(model.snapshot().caches, [
    'strava-dashboard-v1',
    'stravastats-static-v2-000001',
    'unrelated-cache',
  ]);
});

test('failed governed install preserves the old worker and every non-current cache', () => {
  const model = createDrainedLifecycleModel();
  model.failInstall();

  assert.equal(model.snapshot().activeWorker, 'legacy');
  assert.equal(model.snapshot().waitingWorker, null);
  assert.deepEqual(model.snapshot().caches, [
    'strava-dashboard-v1',
    'unrelated-cache',
  ]);
  assert.equal(model.snapshot().clients.length, 2);
});
