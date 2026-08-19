import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { logServerEvent, SERVER_API_EVENT } from '../api/_shared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'api');
const originalEnvKeys = new Set(Object.keys(process.env));
const port = Number(process.env.PORT || 3001);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8']
]);

const spaRoutes = new Set([
  '/',
  '/run',
  '/dashboard',
  '/bike',
  '/swim',
  '/trends',
  '/planner',
  '/gear',
  '/activities',
  '/calendar',
  '/weather',
  '/map',
  '/wrapped',
  '/ai-coach'
]);

const publicRootFiles = new Set([
  '/index.html',
  '/diagnostics.html',
  '/source-manager.html',
  '/storage-backup.html',
  '/theme-preview.html',
  '/manifest.json',
  '/sw.js',
  '/icon-sport.svg',
  '/classifyBike.js',
  '/classifyRun.js'
]);

const publicDirectoryExtensions = new Map([
  ['html', new Set(['.html'])],
  ['js', new Set(['.js', '.mjs'])],
  ['styles', new Set(['.css'])],
  ['media', new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'])]
]);

const blockedPathSegments = new Set([
  '.git',
  '.github',
  'api',
  'docs',
  'node_modules',
  'scripts',
  'tests'
]);

const blockedFileNames = new Set([
  'agents.md',
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock'
]);

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (!existsSync(filePath)) return;

  const contents = await readFile(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!originalEnvKeys.has(key)) {
      process.env[key] = parseEnvValue(rawValue);
    }
  }
}

async function loadEnv() {
  await loadEnvFile('.env');
  await loadEnvFile('.env.local');
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseBody(req) {
  const buffer = await collectBody(req);
  if (buffer.length === 0) return undefined;

  const contentType = req.headers['content-type'] || '';
  const bodyText = buffer.toString('utf8');

  if (contentType.includes('application/json')) {
    return JSON.parse(bodyText);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(bodyText));
  }

  return bodyText;
}

function createApiResponse(res) {
  let statusCode = 200;
  let ended = false;

  return {
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    status(code) {
      statusCode = code;
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.hasHeader('content-type')) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
      }
      res.statusCode = statusCode;
      res.end(JSON.stringify(payload));
      ended = true;
      return this;
    },
    send(payload) {
      res.statusCode = statusCode;
      res.end(payload);
      ended = true;
      return this;
    },
    end(payload = '') {
      res.statusCode = statusCode;
      res.end(payload);
      ended = true;
      return this;
    },
    get ended() {
      return ended || res.writableEnded;
    }
  };
}

async function handleApi(req, res, url) {
  const apiName = decodeURIComponent(url.pathname.replace(/^\/api\//, ''));
  if (!apiName || apiName.includes('/') || apiName.includes('..')) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  const apiPath = path.join(apiDir, `${apiName}.js`);
  if (!apiPath.startsWith(apiDir) || !existsSync(apiPath)) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  try {
    const body = await parseBody(req);
    const moduleUrl = pathToFileURL(apiPath);
    const version = (await stat(apiPath)).mtimeMs;
    const mod = await import(`${moduleUrl.href}?v=${version}`);
    const handler = mod.default;

    if (typeof handler !== 'function') {
      throw new Error(`API route ${apiName} does not export a default handler`);
    }

    const apiReq = {
      method: req.method,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams),
      body
    };
    const apiRes = createApiResponse(res);

    await handler(apiReq, apiRes);

    if (!apiRes.ended) {
      res.end();
    }
  } catch {
    logServerEvent(SERVER_API_EVENT.LOCAL_HANDLER_FAILED);
    if (!res.writableEnded) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
}

function sendStaticText(req, res, statusCode, body) {
  const bodyLength = Buffer.byteLength(body);
  res.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': bodyLength
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function isPathInsideRoot(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath !== ''
    && !relativePath.startsWith(`..${path.sep}`)
    && relativePath !== '..'
    && !path.isAbsolute(relativePath);
}

function hasSafeStaticPathSegments(pathname) {
  if (
    !pathname.startsWith('/')
    || pathname.includes('\0')
    || pathname.includes('\\')
  ) {
    return false;
  }

  if (pathname === '/') return true;

  const segments = pathname.slice(1).split('/');
  return segments.every(segment => {
    const lowerCaseSegment = segment.toLowerCase();
    return segment !== ''
      && segment !== '.'
      && segment !== '..'
      && !segment.startsWith('.')
      && !blockedPathSegments.has(lowerCaseSegment)
      && !blockedFileNames.has(lowerCaseSegment);
  });
}

function isPublicStaticPath(pathname) {
  if (!hasSafeStaticPathSegments(pathname)) return false;
  if (publicRootFiles.has(pathname)) return true;

  const segments = pathname.slice(1).split('/');
  const [topLevelDirectory, ...remainingSegments] = segments;
  const allowedExtensions = publicDirectoryExtensions.get(topLevelDirectory);

  if (!allowedExtensions || remainingSegments.length === 0) return false;

  const extension = path.posix.extname(remainingSegments.at(-1)).toLowerCase();
  return allowedExtensions.has(extension);
}

function decodeStaticPathname(requestTarget) {
  if (typeof requestTarget !== 'string' || !requestTarget.startsWith('/')) return null;

  const queryIndex = requestTarget.indexOf('?');
  const rawPathname = queryIndex === -1
    ? requestTarget
    : requestTarget.slice(0, queryIndex);

  try {
    const pathname = decodeURIComponent(rawPathname);
    return hasSafeStaticPathSegments(pathname) ? pathname : null;
  } catch {
    return null;
  }
}

function resolveStaticPath(requestTarget) {
  const decodedPathname = decodeStaticPathname(requestTarget);
  if (decodedPathname === null) return null;

  if (spaRoutes.has(decodedPathname)) {
    return path.join(rootDir, 'index.html');
  }

  if (!isPublicStaticPath(decodedPathname)) return null;

  const resolvedPath = path.resolve(rootDir, decodedPathname.slice(1));
  return isPathInsideRoot(resolvedPath) ? resolvedPath : null;
}

async function serveFile(req, res, filePath) {
  if (filePath === null) {
    sendStaticText(req, res, 404, 'Not Found');
    return;
  }

  try {
    const resolvedPath = await realpath(filePath);
    const relativePath = path.relative(rootDir, resolvedPath);
    const publicPathname = `/${relativePath.split(path.sep).join('/')}`;

    if (!isPathInsideRoot(resolvedPath) || !isPublicStaticPath(publicPathname)) {
      sendStaticText(req, res, 404, 'Not Found');
      return;
    }

    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) throw new Error('Not a file');

    const contentType = mimeTypes.get(path.extname(resolvedPath).toLowerCase()) || 'application/octet-stream';
    const headers = {
      'content-type': contentType,
      'content-length': fileStat.size
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    const data = await readFile(resolvedPath);
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    sendStaticText(req, res, 404, 'Not Found');
  }
}

export function createLocalDevServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);

      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
        return;
      }

      await serveFile(req, res, resolveStaticPath(req.url));
    } catch {
      logServerEvent(SERVER_API_EVENT.LOCAL_HANDLER_FAILED);
      if (!res.writableEnded) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    }
  });
}

async function startLocalDevServer() {
  // Local dev only: corporate proxies use self-signed CA certs that Node.js doesn't trust.
  // Vercel runs the API handlers directly, so this is never set by the production runtime.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  await loadEnv();

  const server = createLocalDevServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local dev server ready at http://127.0.0.1:${port}`);
  });
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  await startLocalDevServer();
}
