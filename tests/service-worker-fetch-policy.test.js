import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const WORKER_SOURCE = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const TASK_BRIEF = await readFile(
  new URL('../docs/tasks/pr-31-service-worker-cache-boundary.md', import.meta.url),
  'utf8',
);

const ORIGIN = 'https://synthetic.invalid';
const FIXED_CANARY = 'synthetic-fixed-canary';

function createSyntheticPlatform() {
  const headerState = new WeakMap();
  const requestState = new WeakMap();
  const responseState = new WeakMap();

  class SyntheticHeaders {
    constructor(init = {}) {
      const values = new Map();
      if (init instanceof SyntheticHeaders) {
        const existing = headerState.get(init);
        if (!existing) throw new TypeError('Invalid headers');
        for (const [name, value] of existing) values.set(name, value);
      } else {
        for (const [name, value] of Object.entries(init)) {
          values.set(String(name).toLowerCase(), String(value));
        }
      }
      headerState.set(this, values);
    }

    get(name) {
      const values = headerState.get(this);
      if (!values) throw new TypeError('Invalid headers');
      return values.get(String(name).toLowerCase()) ?? null;
    }

    has(name) {
      const values = headerState.get(this);
      if (!values) throw new TypeError('Invalid headers');
      return values.has(String(name).toLowerCase());
    }
  }

  class SyntheticRequest {
    constructor(input, init = {}) {
      let inherited = null;
      if (typeof input === 'string' || input instanceof URL) {
        inherited = { url: String(input) };
      } else {
        inherited = requestState.get(input);
        if (!inherited) throw new TypeError('Invalid request');
      }

      const url = new URL(init.url ?? inherited.url, ORIGIN).href;
      requestState.set(this, {
        url,
        method: init.method ?? inherited.method ?? 'GET',
        mode: init.mode ?? inherited.mode ?? 'cors',
        destination: init.destination ?? inherited.destination ?? '',
        credentials: init.credentials ?? inherited.credentials ?? 'same-origin',
        headers: new SyntheticHeaders(init.headers ?? inherited.headers ?? {}),
      });
    }

    get url() {
      const state = requestState.get(this);
      if (!state) throw new TypeError('Invalid request');
      return state.url;
    }

    get method() {
      const state = requestState.get(this);
      if (!state) throw new TypeError('Invalid request');
      return state.method;
    }

    get mode() {
      const state = requestState.get(this);
      if (!state) throw new TypeError('Invalid request');
      return state.mode;
    }

    get destination() {
      const state = requestState.get(this);
      if (!state) throw new TypeError('Invalid request');
      return state.destination;
    }

    get credentials() {
      const state = requestState.get(this);
      if (!state) throw new TypeError('Invalid request');
      return state.credentials;
    }

    get headers() {
      const state = requestState.get(this);
      if (!state) throw new TypeError('Invalid request');
      return state.headers;
    }
  }

  class SyntheticResponse {
    constructor(body = '', init = {}) {
      responseState.set(this, {
        body,
        status: init.status ?? 200,
        type: init.type ?? 'basic',
        url: init.url ?? '',
        redirected: init.redirected ?? false,
        headers: new SyntheticHeaders(init.headers ?? {}),
      });
    }

    get status() {
      const state = responseState.get(this);
      if (!state) throw new TypeError('Invalid response');
      return state.status;
    }

    get type() {
      const state = responseState.get(this);
      if (!state) throw new TypeError('Invalid response');
      return state.type;
    }

    get url() {
      const state = responseState.get(this);
      if (!state) throw new TypeError('Invalid response');
      return state.url;
    }

    get redirected() {
      const state = responseState.get(this);
      if (!state) throw new TypeError('Invalid response');
      return state.redirected;
    }

    get headers() {
      const state = responseState.get(this);
      if (!state) throw new TypeError('Invalid response');
      return state.headers;
    }

    clone() {
      const state = responseState.get(this);
      if (!state) throw new TypeError('Invalid response');
      return new SyntheticResponse(state.body, {
        status: state.status,
        type: state.type,
        url: state.url,
        redirected: state.redirected,
        headers: state.headers,
      });
    }
  }

  return {
    Headers: SyntheticHeaders,
    Request: SyntheticRequest,
    Response: SyntheticResponse,
    requestData(value) {
      return requestState.get(value);
    },
    responseData(value) {
      return responseState.get(value);
    },
  };
}

function contentTypeForPath(pathname) {
  if (pathname === '/' || pathname === '/index.html') return 'text/html; charset=utf-8';
  if (pathname === '/manifest.json') return 'application/manifest+json';
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.jpg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function createHarness(options = {}) {
  const platform = createSyntheticPlatform();
  if (options.cloneError) {
    Object.defineProperty(platform.Response.prototype, 'clone', {
      configurable: true,
      value() { throw options.cloneError; },
    });
  }
  const handlers = new Map();
  const calls = {
    addAll: 0,
    cacheMatch: 0,
    claim: 0,
    console: 0,
    delete: 0,
    fetch: 0,
    globalMatch: 0,
    open: 0,
    put: 0,
    skipWaiting: 0,
  };
  const seen = { deletedCaches: [], fetchRequests: [], matchRequests: [], putRequests: [] };

  const cache = {
    async addAll() {
      calls.addAll += 1;
      if (options.addAllError) throw options.addAllError;
    },
    async match(request) {
      calls.cacheMatch += 1;
      seen.matchRequests.push(request);
      if (options.matchError) throw options.matchError;
      if (typeof options.cachedResponse === 'function') {
        return options.cachedResponse(request, platform);
      }
      return options.cachedResponse;
    },
    async put(request, response) {
      calls.put += 1;
      seen.putRequests.push({ request, response });
      if (options.putError) throw options.putError;
    },
  };

  if (options.throwOnAddAllAccess) {
    Object.defineProperty(cache, 'addAll', {
      configurable: true,
      get() {
        calls.addAll += 1;
        throw new Error('addAll access is prohibited');
      },
    });
  }

  const cacheStorage = {
    async open(name) {
      calls.open += 1;
      assert.equal(name, 'stravastats-static-v2-000001');
      if (options.openError) throw options.openError;
      return cache;
    },
    async keys() {
      return [
        'strava-dashboard-v1',
        'stravastats-static-v2-000001',
        'unrelated-cache',
      ];
    },
    async delete(name) {
      calls.delete += 1;
      seen.deletedCaches.push(name);
      return true;
    },
  };

  Object.defineProperty(cacheStorage, 'match', {
    configurable: true,
    get() {
      calls.globalMatch += 1;
      if (options.throwOnGlobalMatchAccess) {
        throw new Error('global match access is prohibited');
      }
      return async () => undefined;
    },
  });

  const defaultFetch = async request => {
    const state = platform.requestData(request);
    if (!state) throw new TypeError('Unbranded request reached fetch');
    const parsed = new URL(state.url);
    return new platform.Response('synthetic-static-body', {
      status: 200,
      type: 'basic',
      url: state.url,
      headers: {
        'content-type': contentTypeForPath(parsed.pathname),
        'cache-control': 'public, max-age=3600',
        vary: 'accept-encoding',
      },
    });
  };

  const sandbox = {
    URL,
    Headers: platform.Headers,
    Request: platform.Request,
    Response: platform.Response,
    caches: cacheStorage,
    fetch: async request => {
      calls.fetch += 1;
      seen.fetchRequests.push(request);
      if (options.fetchError) throw options.fetchError;
      return (options.fetchImpl ?? defaultFetch)(request, platform);
    },
    console: {
      log() { calls.console += 1; },
      info() { calls.console += 1; },
      warn() { calls.console += 1; },
      error() { calls.console += 1; },
    },
    self: {
      location: { origin: ORIGIN },
      addEventListener(name, handler) {
        handlers.set(name, handler);
      },
      skipWaiting() {
        calls.skipWaiting += 1;
      },
      clients: {
        claim() {
          calls.claim += 1;
        },
      },
    },
  };

  vm.runInNewContext(WORKER_SOURCE, sandbox, { filename: 'sw.js' });

  return {
    ...platform,
    calls,
    handlers,
    seen,
    makeRequest(path, init = {}) {
      return new platform.Request(new URL(path, ORIGIN), init);
    },
    makeResponse(url, init = {}) {
      return new platform.Response('synthetic-response', {
        status: 200,
        type: 'basic',
        url,
        headers: {
          'content-type': contentTypeForPath(new URL(url).pathname),
          'cache-control': 'public, max-age=3600',
          vary: 'accept-encoding',
        },
        ...init,
      });
    },
    async dispatchFetch(request) {
      let responded = false;
      let responsePromise;
      handlers.get('fetch')({
        request,
        respondWith(value) {
          responded = true;
          responsePromise = Promise.resolve(value);
        },
      });
      const response = responded ? await responsePromise : undefined;
      await new Promise(resolve => setImmediate(resolve));
      return { responded, response };
    },
    async dispatchInstall() {
      let waitPromise;
      handlers.get('install')({
        waitUntil(value) {
          waitPromise = Promise.resolve(value);
        },
      });
      await waitPromise;
      await new Promise(resolve => setImmediate(resolve));
    },
    async dispatchActivate() {
      let waitPromise;
      handlers.get('activate')({
        waitUntil(value) {
          waitPromise = Promise.resolve(value);
        },
      });
      await waitPromise;
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

function assertNoCacheCalls(harness, label) {
  assert.equal(harness.calls.open, 0, `${label}:open`);
  assert.equal(harness.calls.cacheMatch, 0, `${label}:cache-match`);
  assert.equal(harness.calls.put, 0, `${label}:put`);
  assert.equal(harness.calls.addAll, 0, `${label}:add-all`);
  assert.equal(harness.calls.globalMatch, 0, `${label}:global-match`);
}

test('Task Brief freezes corrected Option A and the exact four-path implementation boundary', () => {
  assert.match(TASK_BRIEF, /A — Recommended/);
  assert.match(TASK_BRIEF, /sw\.js/);
  assert.match(TASK_BRIEF, /tests\/service-worker-fetch-policy\.test\.js/);
  assert.match(TASK_BRIEF, /tests\/import\/decoder-registry-wiring\.test\.js/);
  assert.match(TASK_BRIEF, /skipWaiting/);
  assert.match(TASK_BRIEF, /clients\.claim/);
  assert.match(TASK_BRIEF, /P0-08\/D3/);
});

test('selected D3 lifecycle uses immutable names and drains without immediate takeover', () => {
  assert.match(WORKER_SOURCE, /CURRENT_CACHE_NAME = 'stravastats-static-v2-000001'/);
  assert.match(WORKER_SOURCE, /LEGACY_CACHE_NAME = 'strava-dashboard-v1'/);
  assert.match(WORKER_SOURCE, /RETIRED_OWNED_CACHE_NAMES = Object\.freeze\(\[\]\)/);
  assert.doesNotMatch(WORKER_SOURCE, /skipWaiting\s*\(/);
  assert.doesNotMatch(WORKER_SOURCE, /clients\.claim\s*\(/);
  assert.doesNotMatch(WORKER_SOURCE, /caches\.keys\s*\(/);
});

test('private, dynamic, query, credential, Range, and cross-origin requests bypass the worker', async t => {
  const cases = [
    ['same-origin-api', '/api/private', { destination: '' }],
    ['api-js-name', '/api/private.js', { destination: 'script' }],
    ['telemetry', '/_vercel/insights/script.js', { destination: 'script' }],
    ['query-module', `/js/main.js?opaque=${FIXED_CANARY}`, { destination: 'script' }],
    ['detail-opaque-id', `/html/activity-router.html?id=${FIXED_CANARY}`, { destination: 'document', mode: 'navigate' }],
    ['source-mode-query', '/source-manager.html?mode=real', { destination: 'document', mode: 'navigate' }],
    ['root-navigation', '/', { destination: 'document', mode: 'navigate', credentials: 'include' }],
    ['index-navigation', '/index.html', { destination: 'document', mode: 'navigate', credentials: 'include' }],
    ['synthetic-same-origin-navigation', '/', { destination: 'document', mode: 'navigate', credentials: 'same-origin' }],
    ['authorization', '/js/main.js', { destination: 'script', headers: { authorization: FIXED_CANARY } }],
    ['proxy-authorization', '/js/main.js', { destination: 'script', headers: { 'proxy-authorization': FIXED_CANARY } }],
    ['cookie', '/js/main.js', { destination: 'script', headers: { cookie: FIXED_CANARY } }],
    ['api-key', '/js/main.js', { destination: 'script', headers: { 'x-api-key': FIXED_CANARY } }],
    ['auth-token', '/js/main.js', { destination: 'script', headers: { 'x-auth-token': FIXED_CANARY } }],
    ['range', '/media/bg-run.jpg', { destination: 'image', headers: { range: 'bytes=0-1' } }],
    ['non-get', '/js/main.js', { destination: 'script', method: 'POST' }],
    ['include-credentials', '/js/main.js', { destination: 'script', credentials: 'include' }],
    ['empty-destination', '/js/main.js', { destination: '' }],
    ['destination-mismatch', '/styles/style.css', { destination: 'script' }],
    ['unlisted-html', '/html/run.html', { destination: 'document', mode: 'navigate' }],
    ['unlisted-image', '/media/unlisted.jpg', { destination: 'image' }],
    ['encoded-path', '/js/%2e%2e/api/private.js', { destination: 'script' }],
    ['userinfo', `https://user@synthetic.invalid/js/main.js`, { destination: 'script' }],
    ['hash', '/js/main.js#fixed', { destination: 'script' }],
    ['cdn', 'https://cdn.invalid/library.js', { destination: 'script', mode: 'cors' }],
    ['weather', 'https://weather.invalid/private', { destination: '' }],
    ['ai', 'https://ai.invalid/private', { destination: '' }],
    ['map', 'https://tiles.invalid/private.jpg', { destination: 'image' }],
  ];

  for (const [label, path, init] of cases) {
    await t.test(label, async () => {
      const harness = createHarness({ throwOnGlobalMatchAccess: true });
      const result = await harness.dispatchFetch(harness.makeRequest(path, init));
      assert.equal(result.responded, false);
      assert.equal(harness.calls.fetch, 0);
      assertNoCacheCalls(harness, label);
    });
  }
});

test('only the approved static request classes use network-first cache put', async t => {
  const cases = [
    ['root-classifier', '/classifyRun.js', { destination: 'script' }],
    ['nested-module', '/js/app/main.js', { destination: 'script', mode: 'cors' }],
    ['module-worker', '/js/import/synthetic-import-worker.js', { destination: 'worker', mode: 'cors' }],
    ['style', '/styles/style.css', { destination: 'style', mode: 'no-cors' }],
    ['manifest', '/manifest.json', { destination: 'manifest' }],
    ['icon', '/icon-sport.svg', { destination: 'image', mode: 'no-cors' }],
    ['run-background', '/media/bg-run.jpg', { destination: 'image', mode: 'no-cors' }],
    ['bike-background', '/media/bg-bike.jpg', { destination: 'image', mode: 'no-cors' }],
    ['swim-background', '/media/bg-swim.jpg', { destination: 'image', mode: 'no-cors' }],
  ];

  for (const [label, path, init] of cases) {
    await t.test(label, async () => {
      const harness = createHarness({ throwOnGlobalMatchAccess: true });
      const request = harness.makeRequest(path, init);
      const result = await harness.dispatchFetch(request);
      assert.equal(result.responded, true);
      assert.equal(harness.calls.fetch, 1);
      assert.equal(harness.calls.open, 1);
      assert.equal(harness.calls.put, 1);
      assert.equal(harness.calls.cacheMatch, 0);
      assert.equal(harness.calls.addAll, 0);
      assert.equal(harness.calls.globalMatch, 0);
      assert.equal(harness.responseData(result.response)?.body, 'synthetic-static-body');
      assert.notEqual(harness.seen.putRequests[0].response, result.response);
    });
  }
});

test('network responses must satisfy the exact response allowlist before put', async t => {
  const requestPath = '/js/main.js';
  const cases = [
    ['status', { status: 404 }],
    ['opaque', { type: 'opaque' }],
    ['opaqueredirect', { type: 'opaqueredirect' }],
    ['error', { type: 'error' }],
    ['redirected', { redirected: true }],
    ['different-url', { url: `${ORIGIN}/js/other.js` }],
    ['missing-content-type', { headers: { 'cache-control': 'public' } }],
    ['wrong-content-type', { headers: { 'content-type': 'application/json' } }],
    ['no-store', { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-store' } }],
    ['private', { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, private' } }],
    ['no-cache', { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-cache' } }],
    ['vary-star', { headers: { 'content-type': 'text/javascript', vary: '*' } }],
  ];

  for (const [label, override] of cases) {
    await t.test(label, async () => {
      const url = `${ORIGIN}${requestPath}`;
      const harness = createHarness({
        throwOnGlobalMatchAccess: true,
        fetchImpl: async (_request, platform) => new platform.Response('invalid', {
          status: 200,
          type: 'basic',
          url,
          redirected: false,
          headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': 'public, max-age=3600',
            vary: 'accept-encoding',
          },
          ...override,
        }),
      });
      const result = await harness.dispatchFetch(harness.makeRequest(requestPath, {
        destination: 'script',
      }));
      assert.equal(result.responded, true);
      assert.equal(harness.calls.fetch, 1);
      assert.equal(harness.calls.put, 0);
      assert.equal(harness.calls.cacheMatch, 0);
      assert.equal(harness.calls.globalMatch, 0);
    });
  }
});

test('valid cache fallback is revalidated and uses only the explicitly opened cache', async () => {
  const url = `${ORIGIN}/styles/style.css`;
  const harness = createHarness({
    fetchError: new Error('synthetic network failure'),
    throwOnGlobalMatchAccess: true,
    cachedResponse: (_request, platform) => new platform.Response('cached', {
      status: 200,
      type: 'basic',
      url,
      headers: {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    }),
  });
  const result = await harness.dispatchFetch(harness.makeRequest('/styles/style.css', {
    destination: 'style',
    mode: 'no-cors',
  }));
  assert.equal(result.responded, true);
  assert.equal(harness.calls.open, 1);
  assert.equal(harness.calls.cacheMatch, 1);
  assert.equal(harness.calls.globalMatch, 0);
  assert.equal(harness.calls.put, 0);
  assert.equal(harness.responseData(result.response)?.body, 'cached');
});

test('invalid historical cache entries remain inert and are never replayed', async t => {
  const url = `${ORIGIN}/js/main.js`;
  const cases = [
    ['private', { headers: { 'content-type': 'text/javascript', 'cache-control': 'private' } }],
    ['opaque', { type: 'opaque' }],
    ['redirect', { redirected: true }],
    ['wrong-content', { headers: { 'content-type': 'application/json' } }],
  ];
  for (const [label, override] of cases) {
    await t.test(label, async () => {
      const harness = createHarness({
        fetchError: new Error('synthetic network failure'),
        throwOnGlobalMatchAccess: true,
        cachedResponse: (_request, platform) => new platform.Response('historical', {
          status: 200,
          type: 'basic',
          url,
          headers: { 'content-type': 'text/javascript', 'cache-control': 'public' },
          ...override,
        }),
      });
      const result = await harness.dispatchFetch(harness.makeRequest('/js/main.js', {
        destination: 'script',
      }));
      assert.equal(harness.calls.cacheMatch, 1);
      assert.equal(harness.responseData(result.response)?.status, 503);
      assert.equal(harness.calls.delete, 0);
    });
  }
});

test('hostile Request and Response wrappers fail closed without invoking their traps', async t => {
  await t.test('request own accessors are ignored by branded prototype inspection', async () => {
    const harness = createHarness();
    const request = harness.makeRequest('/js/main.js', { destination: 'script' });
    let getterCalls = 0;
    for (const key of ['url', 'method', 'mode', 'destination', 'credentials', 'headers']) {
      Object.defineProperty(request, key, {
        configurable: true,
        get() {
          getterCalls += 1;
          throw new Error('request accessor executed');
        },
      });
    }
    const result = await harness.dispatchFetch(request);
    assert.equal(result.responded, true);
    assert.equal(getterCalls, 0);
    assert.equal(harness.calls.put, 1);
  });

  await t.test('request Proxy is rejected before property traps or Cache Storage', async () => {
    const harness = createHarness();
    let traps = 0;
    const proxy = new Proxy(harness.makeRequest('/js/main.js', { destination: 'script' }), {
      get() { traps += 1; throw new Error('request proxy get'); },
      getOwnPropertyDescriptor() { traps += 1; throw new Error('request proxy descriptor'); },
      ownKeys() { traps += 1; throw new Error('request proxy keys'); },
    });
    const result = await harness.dispatchFetch(proxy);
    assert.equal(result.responded, false);
    assert.equal(traps, 0);
    assertNoCacheCalls(harness, 'request-proxy');
  });

  await t.test('response own accessors are ignored by branded prototype inspection', async () => {
    let getterCalls = 0;
    const harness = createHarness({
      fetchImpl: async (request, platform) => {
        const response = new platform.Response('safe', {
          status: 200,
          type: 'basic',
          url: platform.requestData(request).url,
          headers: { 'content-type': 'text/javascript', 'cache-control': 'public' },
        });
        for (const key of ['status', 'type', 'url', 'redirected', 'headers', 'clone']) {
          Object.defineProperty(response, key, {
            configurable: true,
            get() {
              getterCalls += 1;
              throw new Error('response accessor executed');
            },
          });
        }
        return response;
      },
    });
    await harness.dispatchFetch(harness.makeRequest('/js/main.js', { destination: 'script' }));
    assert.equal(getterCalls, 0);
    assert.equal(harness.calls.put, 1);
  });

  await t.test('response Proxy is returned from network but never cached or inspected', async () => {
    let traps = 0;
    const harness = createHarness({
      fetchImpl: async (request, platform) => new Proxy(new platform.Response('safe', {
        status: 200,
        type: 'basic',
        url: platform.requestData(request).url,
        headers: { 'content-type': 'text/javascript' },
      }), {
        get(target, key, receiver) {
          if (key === 'then') return undefined;
          traps += 1;
          return Reflect.get(target, key, receiver);
        },
        getOwnPropertyDescriptor() { traps += 1; throw new Error('response proxy descriptor'); },
        ownKeys() { traps += 1; throw new Error('response proxy keys'); },
      }),
    });
    const result = await harness.dispatchFetch(harness.makeRequest('/js/main.js', {
      destination: 'script',
    }));
    assert.equal(result.responded, true);
    assert.equal(traps, 0);
    assert.equal(harness.calls.put, 0);
  });
});

test('cache open, clone, put, and match failures are contained without raw output', async t => {
  await t.test('open failure preserves successful network response', async () => {
    const harness = createHarness({ openError: new Error(FIXED_CANARY) });
    const result = await harness.dispatchFetch(harness.makeRequest('/js/main.js', {
      destination: 'script',
    }));
    assert.equal(result.responded, true);
    assert.equal(harness.calls.put, 0);
    assert.equal(harness.calls.console, 0);
  });

  await t.test('clone failure preserves successful network response', async () => {
    const harness = createHarness({
      cloneError: new Error(FIXED_CANARY),
      fetchImpl: async (request, platform) => {
        return new platform.Response('safe', {
          status: 200,
          type: 'basic',
          url: platform.requestData(request).url,
          headers: { 'content-type': 'text/javascript', 'cache-control': 'public' },
        });
      },
    });
    await harness.dispatchFetch(harness.makeRequest('/js/main.js', { destination: 'script' }));
    assert.equal(harness.calls.put, 0);
    assert.equal(harness.calls.console, 0);
  });

  await t.test('put rejection is awaited and contained', async () => {
    const harness = createHarness({ putError: new Error(FIXED_CANARY) });
    const result = await harness.dispatchFetch(harness.makeRequest('/js/main.js', {
      destination: 'script',
    }));
    assert.equal(result.responded, true);
    assert.equal(harness.calls.put, 1);
    assert.equal(harness.calls.console, 0);
  });

  await t.test('match rejection produces fixed 503', async () => {
    const harness = createHarness({
      fetchError: new Error(FIXED_CANARY),
      matchError: new Error(FIXED_CANARY),
      throwOnGlobalMatchAccess: true,
    });
    const result = await harness.dispatchFetch(harness.makeRequest('/js/main.js', {
      destination: 'script',
    }));
    assert.equal(harness.responseData(result.response)?.status, 503);
    assert.equal(harness.calls.console, 0);
    assert.equal(harness.calls.globalMatch, 0);
  });
});

test('install seeds only the three approved credential-omit requests with validated put', async () => {
  const harness = createHarness({ throwOnAddAllAccess: true });
  await harness.dispatchInstall();
  assert.equal(harness.calls.skipWaiting, 0);
  assert.equal(harness.calls.fetch, 3);
  assert.equal(harness.calls.put, 3);
  assert.equal(harness.calls.delete, 0);
  assert.equal(harness.calls.addAll, 0);
  assert.deepEqual(
    harness.seen.fetchRequests.map(request => {
      const state = harness.requestData(request);
      return [new URL(state.url).pathname, state.credentials];
    }).sort(),
    [
      ['/', 'omit'],
      ['/icon-sport.svg', 'omit'],
      ['/manifest.json', 'omit'],
    ],
  );
});

test('activate neither claims clients nor enumerates or deletes caches in the first generation', async () => {
  const harness = createHarness();
  await harness.dispatchActivate();
  assert.equal(harness.calls.claim, 0);
  assert.equal(harness.calls.delete, 0);
});

test('required install seed failures reject and remove only the partial current cache', async t => {
  for (const [label, options] of [
    ['fetch', { fetchError: new Error(FIXED_CANARY) }],
    ['open', { openError: new Error(FIXED_CANARY) }],
    ['validation', {
      fetchImpl: async (request, platform) => {
        const state = platform.requestData(request);
        return new platform.Response('synthetic-invalid-seed', {
          status: 200,
          type: 'basic',
          url: state.url,
          headers: {
            'content-type': 'application/octet-stream',
            'cache-control': 'public, max-age=3600',
          },
        });
      },
    }],
    ['clone', { cloneError: new Error(FIXED_CANARY) }],
    ['put', { putError: new Error(FIXED_CANARY) }],
  ]) {
    await t.test(label, async () => {
      const harness = createHarness({ ...options, throwOnAddAllAccess: true });
      await assert.rejects(harness.dispatchInstall());
      assert.equal(harness.calls.skipWaiting, 0);
      assert.equal(harness.calls.addAll, 0);
      assert.equal(harness.calls.console, 0);
      assert.equal(harness.calls.delete, 1);
      assert.deepEqual(harness.seen.deletedCaches, ['stravastats-static-v2-000001']);
    });
  }
});
