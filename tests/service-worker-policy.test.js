import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyServiceWorkerPolicy,
  isLocalDevelopmentHost,
  SERVICE_WORKER_LIFECYCLE_CODE,
  shouldRegisterServiceWorker,
} from '../js/app/service-worker-policy.js';

test('local development hosts disable Service Worker by default', () => {
  for (const hostname of ['localhost', '127.0.0.1', '::1', '[::1]']) {
    assert.equal(isLocalDevelopmentHost(hostname), true);
    assert.equal(shouldRegisterServiceWorker({ hostname }), false);
  }
});

test('local Service Worker can be enabled explicitly and production remains enabled', () => {
  assert.equal(
    shouldRegisterServiceWorker({ hostname: 'localhost', search: '?enable-sw=1' }),
    true,
  );
  assert.equal(shouldRegisterServiceWorker({ hostname: 'stravastats.vercel.app' }), true);
});

test('disabled local policy unregisters workers and clears only app caches', async () => {
  const unregistered = [];
  const deletedCaches = [];
  const serviceWorker = {
    async getRegistrations() {
      return [
        {
          scope: 'http://localhost:3000/',
          active: { scriptURL: 'http://localhost:3000/sw.js' },
          unregister: async () => unregistered.push('owned') && true,
        },
        {
          scope: 'http://localhost:3000/other/',
          active: { scriptURL: 'http://localhost:3000/other/sw.js' },
          unregister: async () => unregistered.push('unrelated') && true,
        },
      ];
    },
    async register() {
      throw new Error('register must not run for default localhost policy');
    },
  };
  const cacheStorage = {
    async keys() {
      return [
        'strava-dashboard-v1',
        'stravastats-static-v2-000001',
        'strava-dashboard-unowned',
        'stravastats-static-v2-999999',
        'unrelated-cache',
      ];
    },
    async delete(name) {
      deletedCaches.push(name);
      return true;
    },
  };

  const result = await applyServiceWorkerPolicy({
    navigatorObject: { serviceWorker },
    locationObject: {
      hostname: 'localhost',
      search: '',
      origin: 'http://localhost:3000',
    },
    cacheStorage,
    logger: {},
  });

  assert.deepEqual(result, {
    action: 'disabled',
    registrationsChanged: 1,
    cachesChanged: 2,
  });
  assert.deepEqual(unregistered, ['owned']);
  assert.deepEqual(deletedCaches.sort(), [
    'strava-dashboard-v1',
    'stravastats-static-v2-000001',
  ]);
});

test('production policy registers the exact root worker and checks once for an update', async () => {
  const registered = [];
  let updates = 0;

  const result = await applyServiceWorkerPolicy({
    navigatorObject: {
      serviceWorker: {
        controller: { scriptURL: 'https://stravastats.vercel.app/sw.js' },
        addEventListener() {},
        async register(url, options) {
          registered.push([url, options]);
          return {
            waiting: null,
            installing: null,
            addEventListener() {},
            async update() {
              updates += 1;
              return this;
            },
          };
        },
      },
    },
    locationObject: {
      hostname: 'stravastats.vercel.app',
      search: '',
      origin: 'https://stravastats.vercel.app',
    },
    cacheStorage: null,
    logger: {},
  });

  assert.deepEqual(result, {
    action: 'registered',
    registrationsChanged: 1,
    cachesChanged: 0,
    updateStatus: 'checked',
  });
  assert.deepEqual(registered, [[
    '/sw.js',
    { scope: '/', updateViaCache: 'none' },
  ]]);
  assert.equal(updates, 1);
});

test('an already-waiting update emits only the fixed waiting lifecycle code', async () => {
  const lifecycle = [];
  const waiting = { state: 'installed', addEventListener() {} };
  const registration = {
    waiting,
    installing: null,
    addEventListener() {},
    async update() { return this; },
  };

  await applyServiceWorkerPolicy({
    navigatorObject: {
      serviceWorker: {
        controller: { scriptURL: 'https://synthetic.invalid/sw.js' },
        addEventListener() {},
        async register() { return registration; },
      },
    },
    locationObject: {
      hostname: 'synthetic.invalid',
      search: '',
      origin: 'https://synthetic.invalid',
    },
    logger: {},
    onLifecycleState(value) { lifecycle.push(value); },
  });

  assert.deepEqual(lifecycle, [{ code: 'SW_UPDATE_WAITING' }]);
});

test('update observation timeout is fixed, bounded, and does not cancel the browser update', async () => {
  const lifecycle = [];
  let updateStarted = 0;
  const never = new Promise(() => {});

  const result = await applyServiceWorkerPolicy({
    navigatorObject: {
      serviceWorker: {
        controller: { scriptURL: 'https://synthetic.invalid/sw.js' },
        addEventListener() {},
        async register() {
          return {
            waiting: null,
            installing: null,
            addEventListener() {},
            update() {
              updateStarted += 1;
              return never;
            },
          };
        },
      },
    },
    locationObject: {
      hostname: 'synthetic.invalid',
      search: '',
      origin: 'https://synthetic.invalid',
    },
    logger: {},
    onLifecycleState(value) { lifecycle.push(value); },
    updateTimeoutMs: 8000,
    setTimeoutFn(callback, milliseconds) {
      assert.equal(milliseconds, 8000);
      callback();
      return 1;
    },
    clearTimeoutFn() {
      assert.fail('a fired timeout must not be cleared as if update completed');
    },
  });

  assert.equal(updateStarted, 1);
  assert.equal(result.updateStatus, 'timeout');
  assert.deepEqual(lifecycle, [{
    code: SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_CHECK_TIMEOUT,
  }]);
});

test('update rejection and controller change emit only fixed aggregate lifecycle states', async () => {
  const lifecycle = [];
  let controllerChange;

  const result = await applyServiceWorkerPolicy({
    navigatorObject: {
      serviceWorker: {
        controller: { scriptURL: 'https://synthetic.invalid/sw.js' },
        addEventListener(name, callback) {
          if (name === 'controllerchange') controllerChange = callback;
        },
        async register() {
          return {
            waiting: null,
            installing: null,
            addEventListener() {},
            async update() { throw new Error('synthetic-private-canary'); },
          };
        },
      },
    },
    locationObject: {
      hostname: 'synthetic.invalid',
      search: '',
      origin: 'https://synthetic.invalid',
    },
    logger: {},
    onLifecycleState(value) { lifecycle.push(value); },
  });

  controllerChange();
  assert.equal(result.updateStatus, 'failed');
  assert.deepEqual(lifecycle, [
    { code: SERVICE_WORKER_LIFECYCLE_CODE.UPDATE_INSTALL_FAILED },
    { code: SERVICE_WORKER_LIFECYCLE_CODE.ACTIVATED },
  ]);
});
