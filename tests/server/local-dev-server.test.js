import assert from 'node:assert/strict';
import { request } from 'node:http';
import test from 'node:test';

import { createLocalDevServer } from '../../scripts/local-dev-server.mjs';

const RETIRED_ROUTE = ['/run', 'plus'].join('-');
const RETIRED_NESTED_ROUTE = `${RETIRED_ROUTE}/${['n', 'sm'].join('')}`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function requestPath(address, pathname, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({
      host: address.address,
      port: address.port,
      method,
      path: pathname
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    req.once('error', reject);
    req.end();
  });
}

test('local development server exposes only public application assets', async t => {
  const server = createLocalDevServer();
  const address = await listen(server);
  t.after(() => close(server));

  await t.test('serves the app shell, SPA routes, and required asset families', async () => {
    const appShell = await requestPath(address, '/');
    assert.equal(appShell.statusCode, 200);
    assert.match(appShell.headers['content-type'], /^text\/html\b/);
    assert.match(appShell.body.toString('utf8'), /<!doctype html>/i);

    const cases = [
      ['/dashboard', 'text/html'],
      ['/html/run.html', 'text/html'],
      ['/js/main.js', 'text/javascript'],
      ['/styles/style.css', 'text/css'],
      ['/media/bg-run.jpg', 'image/jpeg'],
      ['/icon-sport.svg', 'image/svg+xml'],
      ['/manifest.json', 'application/json'],
      ['/sw.js', 'text/javascript'],
      ['/classifyRun.js', 'text/javascript'],
      ['/source-manager.html?mode=real', 'text/html']
    ];

    for (const [pathname, contentType] of cases) {
      const response = await requestPath(address, pathname);
      assert.equal(response.statusCode, 200, pathname);
      assert.ok(response.headers['content-type'].startsWith(contentType), pathname);
      assert.ok(response.body.length > 0, pathname);
    }
  });

  await t.test('returns 404 without exposing repository and private paths', async () => {
    const blockedPaths = [
      '/.env',
      '/.env.local',
      '/.env.example',
      '/.git/config',
      '/.github/workflows',
      '/node_modules/node-fetch/package.json',
      '/tests/feature-flags.test.js',
      '/docs/README.md',
      '/scripts/local-dev-server.mjs',
      '/package.json',
      '/package-lock.json',
      '/AGENTS.md',
      '/README.md',
      '/js/data/AGENTS.md',
      '/js/vendor/THIRD_PARTY_NOTICES.md',
      '/media/README.md',
      '/js/main.js.map',
      '/styles',
      '/not-an-app-route',
      RETIRED_ROUTE,
      RETIRED_NESTED_ROUTE
    ];

    for (const pathname of blockedPaths) {
      const response = await requestPath(address, pathname);
      assert.equal(response.statusCode, 404, pathname);
      assert.equal(response.body.toString('utf8'), 'Not Found', pathname);
    }
  });

  await t.test('decodes valid public paths and rejects encoded or literal traversal', async () => {
    const encodedAsset = await requestPath(address, '/styles%2Fstyle.css');
    assert.equal(encodedAsset.statusCode, 200);
    assert.match(encodedAsset.headers['content-type'], /^text\/css\b/);

    const traversalPaths = [
      '/js/../classifyRun.js',
      '/js/%2e%2e/classifyRun.js',
      '/js/%2E%2E%2Fpackage.json',
      '/%2e%2e%2fpackage.json',
      '/%2eenv.local',
      '/%2egit/config',
      '/js/%2ehidden.js',
      '/js%5c..%5cpackage.json',
      '/js/%',
      '//package.json'
    ];

    for (const pathname of traversalPaths) {
      const response = await requestPath(address, pathname);
      assert.equal(response.statusCode, 404, pathname);
      assert.equal(response.body.toString('utf8'), 'Not Found', pathname);
    }
  });

  await t.test('HEAD mirrors static GET metadata and never sends a body', async () => {
    const getResponse = await requestPath(address, '/js/main.js');
    const headResponse = await requestPath(address, '/js/main.js', { method: 'HEAD' });

    assert.equal(headResponse.statusCode, getResponse.statusCode);
    assert.equal(headResponse.headers['content-type'], getResponse.headers['content-type']);
    assert.equal(headResponse.headers['content-length'], String(getResponse.body.length));
    assert.equal(headResponse.body.length, 0);

    const missingHead = await requestPath(address, '/package.json', { method: 'HEAD' });
    assert.equal(missingHead.statusCode, 404);
    assert.equal(missingHead.headers['content-length'], String(Buffer.byteLength('Not Found')));
    assert.equal(missingHead.body.length, 0);
  });
});
