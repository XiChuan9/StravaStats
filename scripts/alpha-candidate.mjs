import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, readFileSync } from 'node:fs';
import {
  lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALPHA_VERSION = '2.0.0-alpha.1';
export const ALPHA_RELEASE_NAME = `v${ALPHA_VERSION}`;
export const REQUIRED_NODE_VERSION = 'v24.19.0';
export const REQUIRED_NPM_VERSION = '11.17.0';
export const AUTHORIZED_BRANCH = 'codex/v2/release-head-verification';
export const AUTHORIZED_BASE_BRANCH = 'integration/v2';
export const AUTHORIZED_BASE_SHA = '57c2cdf9358afef1330d5a71f3799f18d41f6d13';
export const AUTHORIZED_PR_NUMBER = 62;
export const AUTHORIZED_REPOSITORY = 'XiChuan9/StravaStats';
export const SOURCE_REPOSITORY = 'https://github.com/XiChuan9/StravaStats.git';
export const PAYLOAD_RULE_VERSION = 'g1-alpha-static-v1';
const ROOT_NAME = `stravastats-${ALPHA_RELEASE_NAME}`;
const ZIP_NAME = `${ROOT_NAME}.zip`;
const EVIDENCE_NAME = `${ROOT_NAME}.evidence.json`;
const EXACT_PAYLOAD = new Set([
  'classifyBike.js', 'classifyRun.js', 'diagnostics.html', 'icon-sport.svg',
  'index.html', 'manifest.json', 'source-manager.html', 'storage-backup.html', 'sw.js',
  'js/vendor/THIRD_PARTY_NOTICES.md', 'media/bg-bike.jpg', 'media/bg-run.jpg',
  'media/bg-swim.jpg',
]);
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.jpg', 'image/jpeg'], ['.md', 'text/markdown; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'],
]);
const SPA_ROUTES = new Set([
  '/', '/run', '/run-plus', '/run-plus/nsm', '/dashboard', '/bike', '/swim', '/trends',
  '/planner', '/gear', '/activities', '/calendar', '/weather', '/map', '/wrapped', '/ai-coach',
]);

function fail(message) { throw new Error(message); }
function byteCompare(left, right) { return Buffer.from(left).compare(Buffer.from(right)); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonicalJson(record) { return Buffer.from(`${JSON.stringify(record)}\n`, 'utf8'); }
function safePath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 4096
    && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..')
    && !/[\0-\x1f\x7f]/.test(path);
}
function selectedPath(path) {
  return EXACT_PAYLOAD.has(path)
    || /^html\/.*\.html$/.test(path)
    || /^js\/.*\.js$/.test(path)
    || /^styles\/.*\.css$/.test(path);
}

export function selectPayloadPaths(records) {
  if (!Array.isArray(records)) fail('PAYLOAD_RECORDS_INVALID');
  const selected = [];
  const seen = new Set();
  for (const record of records) {
    const { mode, type, object, path } = record ?? {};
    if (!selectedPath(path)) continue;
    if (!safePath(path) || seen.has(path)) fail('PAYLOAD_PATH_INVALID');
    if (mode !== '100644' || type !== 'blob' || !/^[0-9a-f]{40}$/.test(object)) {
      fail('PAYLOAD_NOT_REGULAR');
    }
    seen.add(path);
    selected.push(Object.freeze({ mode, type, object, path }));
  }
  for (const path of EXACT_PAYLOAD) if (!seen.has(path)) fail('PAYLOAD_REQUIRED_MISSING');
  selected.sort((a, b) => byteCompare(a.path, b.path));
  return Object.freeze(selected);
}

export function createProvenanceBytes({ commit, tree, sourceDateEpoch }) {
  if (!/^[0-9a-f]{40}$/.test(commit) || !/^[0-9a-f]{40}$/.test(tree)) fail('PROVENANCE_GIT_INVALID');
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 0) fail('PROVENANCE_TIME_INVALID');
  return canonicalJson({
    version: ALPHA_RELEASE_NAME,
    commit,
    tree,
    sourceRepository: SOURCE_REPOSITORY,
    buildCommand: 'npm run build:alpha-candidate',
    nodeVersion: REQUIRED_NODE_VERSION,
    npmVersion: REQUIRED_NPM_VERSION,
    sourceDateEpoch,
    payloadSelectionRuleVersion: PAYLOAD_RULE_VERSION,
  });
}

export function createEvidenceBytes({ commit, tree, manifestSha256, containerSha256 }) {
  if (!/^[0-9a-f]{40}$/.test(commit) || !/^[0-9a-f]{40}$/.test(tree)
      || !/^[0-9a-f]{64}$/.test(manifestSha256)
      || !/^[0-9a-f]{64}$/.test(containerSha256)) fail('EVIDENCE_VALUE_INVALID');
  return canonicalJson({
    version: ALPHA_RELEASE_NAME, commit, tree,
    manifestFile: `${ROOT_NAME}/SHA256SUMS`, manifestSha256,
    containerFile: ZIP_NAME, containerSha256,
  });
}

export function createSha256SumsBytes(files) {
  if (!(files instanceof Map)) fail('MANIFEST_INPUT_INVALID');
  const paths = [...files.keys()].sort(byteCompare);
  if (paths.length === 0 || paths.includes('SHA256SUMS')) fail('MANIFEST_INPUT_INVALID');
  const rows = [];
  for (const path of paths) {
    const bytes = files.get(path);
    if (!safePath(path) || !Buffer.isBuffer(bytes)) fail('MANIFEST_INPUT_INVALID');
    rows.push(`${sha256(bytes)}  ${path}`);
  }
  return Buffer.from(`${rows.join('\n')}\n`, 'utf8');
}

const CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
}));
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function u16(value) { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b; }
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b; }

export function createStoredZipBytes(files, rootName = ROOT_NAME) {
  if (!(files instanceof Map) || !safePath(rootName) || rootName.includes('/')) fail('ZIP_INPUT_INVALID');
  const paths = [...files.keys()].sort(byteCompare);
  const local = [];
  const central = [];
  let offset = 0;
  for (const path of paths) {
    if (!safePath(path) || path.endsWith('/') || !Buffer.isBuffer(files.get(path))) fail('ZIP_INPUT_INVALID');
    const name = Buffer.from(`${rootName}/${path}`, 'utf8');
    const data = files.get(path);
    const crc = crc32(data);
    const header = Buffer.concat([
      u32(0x04034b50), u16(10), u16(0x0800), u16(0), u16(0), u16(0x0021), u32(crc),
      u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ]);
    local.push(header, data);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(0x0314), u16(10), u16(0x0800), u16(0), u16(0), u16(0x0021),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0),
      u16(0), u32(0x81a40000), u32(offset), name,
    ]));
    offset += header.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  if (paths.length > 0xffff || offset + centralBytes.length + 22 > 0xffffffff) fail('ZIP32_LIMIT');
  return Buffer.concat([...local, centralBytes, Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(paths.length), u16(paths.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ])]);
}

function zipU16(bytes, offset) {
  if (offset < 0 || offset + 2 > bytes.length) fail('CONTAINER_PROFILE');
  return bytes.readUInt16LE(offset);
}
function zipU32(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) fail('CONTAINER_PROFILE');
  return bytes.readUInt32LE(offset);
}
function auditCrc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

export function auditStoredZip32Bytes(bytes, expectedFiles, rootName = ROOT_NAME) {
  if (!Buffer.isBuffer(bytes) || !(expectedFiles instanceof Map)
      || !safePath(rootName) || rootName.includes('/') || bytes.length < 22) fail('CONTAINER_PROFILE');
  const expectedPaths = [...expectedFiles.keys()].sort(byteCompare);
  if (expectedPaths.length === 0 || expectedPaths.length > 0xffff) fail('CONTAINER_PROFILE');
  for (const path of expectedPaths) {
    if (!safePath(path) || path.endsWith('/') || !Buffer.isBuffer(expectedFiles.get(path))) fail('CONTAINER_PROFILE');
  }

  const eocd = bytes.length - 22;
  if (zipU32(bytes, eocd) !== 0x06054b50
      || zipU16(bytes, eocd + 4) !== 0 || zipU16(bytes, eocd + 6) !== 0
      || zipU16(bytes, eocd + 8) !== expectedPaths.length
      || zipU16(bytes, eocd + 10) !== expectedPaths.length
      || zipU16(bytes, eocd + 20) !== 0) fail('CONTAINER_PROFILE');
  const centralSize = zipU32(bytes, eocd + 12);
  const centralOffset = zipU32(bytes, eocd + 16);
  if (centralOffset + centralSize !== eocd) fail('CONTAINER_PROFILE');

  const entries = [];
  let cursor = centralOffset;
  for (const path of expectedPaths) {
    if (zipU32(bytes, cursor) !== 0x02014b50) fail('CONTAINER_PROFILE');
    const nameLength = zipU16(bytes, cursor + 28);
    const extraLength = zipU16(bytes, cursor + 30);
    const commentLength = zipU16(bytes, cursor + 32);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > eocd
        || zipU16(bytes, cursor + 4) !== 0x0314
        || zipU16(bytes, cursor + 6) !== 10
        || zipU16(bytes, cursor + 8) !== 0x0800
        || zipU16(bytes, cursor + 10) !== 0
        || zipU16(bytes, cursor + 12) !== 0
        || zipU16(bytes, cursor + 14) !== 0x0021
        || extraLength !== 0 || commentLength !== 0
        || zipU16(bytes, cursor + 34) !== 0
        || zipU16(bytes, cursor + 36) !== 0
        || zipU32(bytes, cursor + 38) !== 0x81a40000) fail('CONTAINER_PROFILE');
    const expectedName = `${rootName}/${path}`;
    if (bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength) !== expectedName
        || nameLength !== Buffer.byteLength(expectedName)) fail('CONTAINER_PROFILE');
    const data = expectedFiles.get(path);
    if (zipU32(bytes, cursor + 16) !== auditCrc32(data)
        || zipU32(bytes, cursor + 20) !== data.length
        || zipU32(bytes, cursor + 24) !== data.length) fail('CONTAINER_PROFILE');
    entries.push(Object.freeze({
      path, crc: zipU32(bytes, cursor + 16), size: data.length,
      localOffset: zipU32(bytes, cursor + 42),
    }));
    cursor = end;
  }
  if (cursor !== eocd || cursor - centralOffset !== centralSize) fail('CONTAINER_PROFILE');

  cursor = 0;
  for (const entry of entries) {
    const data = expectedFiles.get(entry.path);
    const expectedName = `${rootName}/${entry.path}`;
    if (entry.localOffset !== cursor || zipU32(bytes, cursor) !== 0x04034b50) fail('CONTAINER_PROFILE');
    const nameLength = zipU16(bytes, cursor + 26);
    const extraLength = zipU16(bytes, cursor + 28);
    const dataOffset = cursor + 30 + nameLength + extraLength;
    const end = dataOffset + data.length;
    if (end > centralOffset
        || zipU16(bytes, cursor + 4) !== 10
        || zipU16(bytes, cursor + 6) !== 0x0800
        || zipU16(bytes, cursor + 8) !== 0
        || zipU16(bytes, cursor + 10) !== 0
        || zipU16(bytes, cursor + 12) !== 0x0021
        || zipU32(bytes, cursor + 14) !== entry.crc
        || zipU32(bytes, cursor + 18) !== entry.size
        || zipU32(bytes, cursor + 22) !== entry.size
        || extraLength !== 0
        || bytes.toString('utf8', cursor + 30, cursor + 30 + nameLength) !== expectedName
        || nameLength !== Buffer.byteLength(expectedName)
        || !bytes.subarray(dataOffset, end).equals(data)) fail('CONTAINER_PROFILE');
    cursor = end;
  }
  if (cursor !== centralOffset) fail('CONTAINER_PROFILE');
  return Object.freeze({ entryCount: entries.length, paths: Object.freeze([...expectedPaths]) });
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd ?? process.cwd(), encoding: options.encoding ?? 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}
function treeRecords(commit, cwd) {
  return git(['ls-tree', '-rz', '--full-tree', commit], { cwd, encoding: 'buffer' }).toString('utf8')
    .split('\0').filter(Boolean).map(line => {
      const tab = line.indexOf('\t');
      const [mode, type, object] = line.slice(0, tab).split(' ');
      return { mode, type, object, path: line.slice(tab + 1) };
    });
}
function gitBlob(object, cwd) { return git(['cat-file', 'blob', object], { cwd, encoding: 'buffer' }); }
function exactNpmVersion() {
  return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
}
function assertToolchain() {
  if (process.version !== REQUIRED_NODE_VERSION) fail(`NODE_VERSION_REQUIRED:${REQUIRED_NODE_VERSION}`);
  if (exactNpmVersion() !== REQUIRED_NPM_VERSION) fail(`NPM_VERSION_REQUIRED:${REQUIRED_NPM_VERSION}`);
}
function assertClean(cwd) {
  if (git(['status', '--porcelain=v1', '--untracked-files=all'], { cwd }) !== '') fail('WORKTREE_NOT_CLEAN');
}
function canonicalRepositoryUrl(value) {
  return String(value ?? '').trim().replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
}
function exactRef(cwd, ref) {
  try { return git(['rev-parse', '--verify', ref], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
export function assertAuthorizedBranch({ cwd = process.cwd(), commit, env = process.env } = {}) {
  const exactCommit = commit ?? git(['rev-parse', 'HEAD'], { cwd }).trim();
  if (exactRef(cwd, 'HEAD') !== exactCommit) fail('AUTHORIZED_HEAD_MISMATCH');
  let branch = null;
  try {
    branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {}
  if (env.GITHUB_ACTIONS === 'true' && branch !== null) fail('AUTHORIZED_ACTIONS_DETACHED_HEAD_REQUIRED');
  if (branch === AUTHORIZED_BRANCH) {
    if (env.ALPHA_CANDIDATE_AUTHORIZED_HEAD !== exactCommit) fail('AUTHORIZED_HEAD_REQUIRED');
    let origin;
    try {
      origin = git(['remote', 'get-url', 'origin'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
    if (canonicalRepositoryUrl(origin) !== canonicalRepositoryUrl(SOURCE_REPOSITORY)) fail('AUTHORIZED_REPOSITORY_REQUIRED');
    let upstream = null;
    try {
      upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
        cwd, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {}
    if (upstream === `origin/${AUTHORIZED_BRANCH}` && exactRef(cwd, upstream) === exactCommit) return;
    fail('AUTHORIZED_REMOTE_HEAD_REQUIRED');
  }
  if (branch !== null) fail(`AUTHORIZED_BRANCH_REQUIRED:${AUTHORIZED_BRANCH}`);
  let event;
  try {
    event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {}
  const authorizedDetached = env.GITHUB_ACTIONS === 'true'
    && env.GITHUB_EVENT_NAME === 'pull_request'
    && env.GITHUB_HEAD_REF === AUTHORIZED_BRANCH
    && env.GITHUB_BASE_REF === AUTHORIZED_BASE_BRANCH
    && env.GITHUB_REPOSITORY === AUTHORIZED_REPOSITORY
    && env.ALPHA_CANDIDATE_AUTHORIZED_HEAD === exactCommit
    && event?.number === AUTHORIZED_PR_NUMBER
    && event?.repository?.full_name === AUTHORIZED_REPOSITORY
    && event?.pull_request?.state === 'open'
    && event?.pull_request?.draft === true
    && event?.pull_request?.head?.ref === AUTHORIZED_BRANCH
    && event?.pull_request?.head?.sha === exactCommit
    && event?.pull_request?.head?.repo?.full_name === AUTHORIZED_REPOSITORY
    && event?.pull_request?.base?.ref === AUTHORIZED_BASE_BRANCH
    && event?.pull_request?.base?.sha === AUTHORIZED_BASE_SHA
    && event?.pull_request?.base?.repo?.full_name === AUTHORIZED_REPOSITORY;
  if (!authorizedDetached) fail(`AUTHORIZED_BRANCH_REQUIRED:${AUTHORIZED_BRANCH}`);
}
function gitBoundaryRoots(cwd) {
  let topLevel;
  let gitDirectory;
  let gitCommonDirectory;
  try {
    topLevel = git(['rev-parse', '--path-format=absolute', '--show-toplevel'], { cwd }).trim();
    gitDirectory = git(['rev-parse', '--path-format=absolute', '--git-dir'], { cwd }).trim();
    gitCommonDirectory = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd }).trim();
  } catch { fail('REPOSITORY_BOUNDARY_REQUIRED'); }
  return [topLevel, gitDirectory, gitCommonDirectory];
}
function registeredWorktreeRoots(cwd) {
  let listing;
  try {
    listing = git(['worktree', 'list', '--porcelain', '-z'], { cwd, encoding: 'buffer' });
  } catch { fail('WORKTREE_BOUNDARY_REQUIRED'); }
  if (!Buffer.isBuffer(listing) || listing.length < 2
      || listing.at(-2) !== 0 || listing.at(-1) !== 0) fail('WORKTREE_BOUNDARY_REQUIRED');
  const text = listing.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(listing)) fail('WORKTREE_BOUNDARY_REQUIRED');
  const roots = text.slice(0, -2).split('\0\0').map(record => {
    const fields = record.split('\0');
    if (fields.length < 2 || fields.some(field => field.length === 0)
        || !fields[0].startsWith('worktree ')
        || fields.slice(1).some(field => field.startsWith('worktree '))) {
      fail('WORKTREE_BOUNDARY_REQUIRED');
    }
    const root = fields[0].slice('worktree '.length);
    if (!isAbsolute(root)) fail('WORKTREE_BOUNDARY_REQUIRED');
    let headCount = 0;
    let stateCount = 0;
    const singletonFields = new Set();
    for (const field of fields.slice(1)) {
      if (/^HEAD [0-9a-f]{40}$/.test(field)) headCount += 1;
      else if (/^branch refs\/heads\/[^\x00-\x20\x7f]+$/.test(field)
          || field === 'detached' || field === 'bare') stateCount += 1;
      else if (field === 'locked' || field.startsWith('locked ')) singletonFields.add('locked');
      else if (field === 'prunable' || field.startsWith('prunable ')) singletonFields.add('prunable');
      else fail('WORKTREE_BOUNDARY_REQUIRED');
    }
    if (headCount > 1 || stateCount !== 1
        || (fields.includes('bare') ? headCount !== 0 : headCount !== 1)
        || singletonFields.size !== fields.filter(
          field => /^(?:locked|prunable)(?: |$)/.test(field),
        ).length) fail('WORKTREE_BOUNDARY_REQUIRED');
    return root;
  });
  if (roots.length === 0 || new Set(roots).size !== roots.length) fail('WORKTREE_BOUNDARY_REQUIRED');
  return roots;
}
function pathInside(path, boundary) {
  return path === boundary || path.startsWith(`${boundary}${sep}`);
}
export async function assertEmptyExternalParent(parent, cwd) {
  if (!isAbsolute(parent)) fail('OUTPUT_PARENT_NOT_ABSOLUTE');
  const resolvedParent = resolve(parent);
  let physicalParent;
  let physicalRepositoryBoundaries;
  try {
    physicalParent = await realpath(resolvedParent);
    physicalRepositoryBoundaries = await Promise.all(
      gitBoundaryRoots(cwd).map(boundary => realpath(boundary)),
    );
  } catch { fail('OUTPUT_PARENT_REALPATH_REQUIRED'); }
  let physicalWorktreeBoundaries;
  try {
    physicalWorktreeBoundaries = await Promise.all(
      registeredWorktreeRoots(cwd).map(boundary => realpath(boundary)),
    );
  } catch { fail('WORKTREE_BOUNDARY_REQUIRED'); }
  if (!physicalWorktreeBoundaries.includes(physicalRepositoryBoundaries[0])
      || new Set(physicalWorktreeBoundaries).size !== physicalWorktreeBoundaries.length) {
    fail('WORKTREE_BOUNDARY_REQUIRED');
  }
  const physicalBoundaries = [...new Set([
    ...physicalRepositoryBoundaries, ...physicalWorktreeBoundaries,
  ])];
  if (physicalBoundaries.some(boundary => pathInside(physicalParent, boundary))) fail('OUTPUT_INSIDE_REPOSITORY');
  const parentInfo = await lstat(resolvedParent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) fail('OUTPUT_PARENT_NOT_DIRECTORY');
  if ((await readdir(physicalParent)).length !== 0) fail('OUTPUT_PARENT_NOT_EMPTY');
  const physicalContainer = await realpath(dirname(physicalParent));
  if (physicalBoundaries.some(boundary => pathInside(physicalContainer, boundary))) fail('OUTPUT_INSIDE_REPOSITORY');
  return physicalParent;
}

async function writeBundle(root, files) {
  for (const [path, bytes] of files) {
    const target = join(root, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx', mode: 0o644 });
  }
}

async function walkFiles(root, current = '', output = []) {
  const directory = join(root, ...current.split('/').filter(Boolean));
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = current ? `${current}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) fail('BUNDLE_SYMLINK');
    if (entry.isDirectory()) await walkFiles(root, path, output);
    else if (entry.isFile()) output.push(path);
    else fail('BUNDLE_SPECIAL_FILE');
  }
  return output;
}

export async function verifyCandidate({ bundleRoot, container, evidence, cwd = process.cwd() }) {
  const root = resolve(bundleRoot);
  let rootInfo;
  try { rootInfo = await lstat(root); } catch { fail('BUNDLE_ROOT_REQUIRED'); }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('BUNDLE_ROOT_REQUIRED');
  const bundle = await verifyBundleRoot(root);
  const provenanceBytes = await readFile(join(root, 'PROVENANCE.json'));
  let provenance;
  try { provenance = JSON.parse(provenanceBytes); } catch { fail('PROVENANCE_GRAMMAR'); }
  const keys = [
    'version', 'commit', 'tree', 'sourceRepository', 'buildCommand', 'nodeVersion',
    'npmVersion', 'sourceDateEpoch', 'payloadSelectionRuleVersion',
  ];
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)
      || Object.keys(provenance).length !== keys.length
      || Object.keys(provenance).some((key, index) => key !== keys[index])) fail('PROVENANCE_SCHEMA');
  const commit = git(['rev-parse', 'HEAD'], { cwd }).trim();
  const tree = git(['rev-parse', 'HEAD^{tree}'], { cwd }).trim();
  const sourceDateEpoch = Number(git(['show', '-s', '--format=%ct', commit], { cwd }).trim());
  const expectedProvenance = createProvenanceBytes({ commit, tree, sourceDateEpoch });
  if (!provenanceBytes.equals(expectedProvenance)) fail('PROVENANCE_SOURCE');
  const pkg = JSON.parse(git(['show', `${commit}:package.json`], { cwd }));
  const lock = JSON.parse(git(['show', `${commit}:package-lock.json`], { cwd }));
  if (pkg.version !== ALPHA_VERSION || pkg.private !== true
      || pkg.engines?.node !== REQUIRED_NODE_VERSION.slice(1)
      || pkg.packageManager !== `npm@${REQUIRED_NPM_VERSION}`
      || lock.version !== ALPHA_VERSION || lock.packages?.['']?.version !== ALPHA_VERSION
      || lock.packages?.['']?.engines?.node !== REQUIRED_NODE_VERSION.slice(1)) fail('CANDIDATE_SOURCE_METADATA');
  const expected = new Map(selectPayloadPaths(treeRecords(commit, cwd))
    .map(record => [record.path, Buffer.from(gitBlob(record.object, cwd))]));
  expected.set('PROVENANCE.json', expectedProvenance);
  expected.set('SHA256SUMS', createSha256SumsBytes(expected));
  const expectedPaths = [...expected.keys()].sort(byteCompare);
  if (bundle.paths.length !== expectedPaths.length
      || bundle.paths.some((path, index) => path !== expectedPaths[index])) fail('CANDIDATE_SOURCE_PAYLOAD');
  for (const [path, bytes] of expected) {
    if (!(await readFile(join(root, ...path.split('/')))).equals(bytes)) fail('CANDIDATE_SOURCE_PAYLOAD');
  }
  if (container === undefined) fail('CONTAINER_FILE_REQUIRED');
  const resolvedContainer = resolve(container);
  const resolvedEvidence = resolve(evidence ?? join(dirname(resolvedContainer), EVIDENCE_NAME));
  if (basename(resolvedContainer) !== ZIP_NAME || dirname(resolvedContainer) !== dirname(root)
      || basename(root) !== ROOT_NAME || dirname(root) !== dirname(resolvedContainer)
      || basename(resolvedEvidence) !== EVIDENCE_NAME
      || dirname(resolvedEvidence) !== dirname(resolvedContainer)) fail('CANDIDATE_SIBLING_LAYOUT');
  const [physicalRoot, physicalContainerParent, physicalEvidenceParent] = await Promise.all([
    realpath(root), realpath(dirname(resolvedContainer)), realpath(dirname(resolvedEvidence)),
  ]);
  if (dirname(physicalRoot) !== physicalContainerParent || physicalContainerParent !== physicalEvidenceParent) {
    fail('CANDIDATE_SIBLING_LAYOUT');
  }
  let containerInfo;
  let evidenceInfo;
  try { containerInfo = await lstat(resolvedContainer); } catch { fail('CONTAINER_FILE_REQUIRED'); }
  try { evidenceInfo = await lstat(resolvedEvidence); } catch { fail('EVIDENCE_FILE_REQUIRED'); }
  if (!containerInfo.isFile() || containerInfo.isSymbolicLink()) fail('CONTAINER_FILE_REQUIRED');
  if (!evidenceInfo.isFile() || evidenceInfo.isSymbolicLink()) fail('EVIDENCE_FILE_REQUIRED');
  const zip = await readFile(resolvedContainer);
  const reconstructed = new Map();
  for (const path of bundle.paths) reconstructed.set(path, await readFile(join(root, ...path.split('/'))));
  auditStoredZip32Bytes(zip, reconstructed);
  const expectedEvidence = createEvidenceBytes({
    commit, tree, manifestSha256: bundle.manifestSha256, containerSha256: sha256(zip),
  });
  let evidenceBytes;
  try { evidenceBytes = await readFile(resolvedEvidence); } catch { fail('EVIDENCE_FILE_REQUIRED'); }
  let evidenceRecord;
  try { evidenceRecord = JSON.parse(evidenceBytes); } catch { fail('EVIDENCE_GRAMMAR'); }
  const evidenceKeys = [
    'version', 'commit', 'tree', 'manifestFile', 'manifestSha256', 'containerFile', 'containerSha256',
  ];
  if (!evidenceRecord || typeof evidenceRecord !== 'object' || Array.isArray(evidenceRecord)
      || Object.keys(evidenceRecord).length !== evidenceKeys.length
      || Object.keys(evidenceRecord).some((key, index) => key !== evidenceKeys[index])) fail('EVIDENCE_SCHEMA');
  if (!evidenceBytes.equals(expectedEvidence)) fail('EVIDENCE_AUTHENTICATION');
  return Object.freeze({
    manifestSha256: bundle.manifestSha256, containerSha256: sha256(zip),
    evidenceSha256: sha256(evidenceBytes), selectedFileCount: expectedPaths.length - 2,
    fileCount: bundle.fileCount, commit, tree, sourceDateEpoch,
  });
}

async function verifyBundleRoot(bundleRoot) {
  const root = resolve(bundleRoot);
  const manifest = await readFile(join(root, 'SHA256SUMS'));
  const text = manifest.toString('utf8');
  if (!text.endsWith('\n') || text.includes('\r')) fail('MANIFEST_GRAMMAR');
  const expected = new Map();
  let previous = null;
  for (const row of text.slice(0, -1).split('\n')) {
    const match = /^([0-9a-f]{64})  ([^\x00-\x1f\x7f\\]+)$/.exec(row);
    if (!match || !safePath(match[2]) || match[2] === 'SHA256SUMS') fail('MANIFEST_GRAMMAR');
    if (previous !== null && byteCompare(previous, match[2]) >= 0) fail('MANIFEST_ORDER');
    previous = match[2]; expected.set(match[2], match[1]);
  }
  const actual = (await walkFiles(root)).sort(byteCompare);
  const named = [...expected.keys(), 'SHA256SUMS'].sort(byteCompare);
  if (actual.length !== named.length || actual.some((path, index) => path !== named[index])) fail('BUNDLE_FILE_SET');
  for (const [path, digest] of expected) if (sha256(await readFile(join(root, ...path.split('/')))) !== digest) fail('BUNDLE_HASH');
  let provenance;
  try { provenance = JSON.parse(await readFile(join(root, 'PROVENANCE.json'), 'utf8')); }
  catch { fail('PROVENANCE_GRAMMAR'); }
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)
      || provenance.version !== ALPHA_RELEASE_NAME) fail('PROVENANCE_VERSION');
  return Object.freeze({ manifestSha256: sha256(manifest), fileCount: actual.length, paths: Object.freeze(actual) });
}

export async function buildCandidate({ outputParent, cwd = process.cwd() } = {}) {
  assertToolchain();
  assertClean(cwd);
  const parent = await assertEmptyExternalParent(outputParent, cwd);
  const commit = git(['rev-parse', 'HEAD'], { cwd }).trim();
  assertAuthorizedBranch({ cwd, commit });
  const tree = git(['rev-parse', 'HEAD^{tree}'], { cwd }).trim();
  const sourceDateEpoch = Number(git(['show', '-s', '--format=%ct', commit], { cwd }).trim());
  const pkg = JSON.parse(git(['show', `${commit}:package.json`], { cwd }));
  const lock = JSON.parse(git(['show', `${commit}:package-lock.json`], { cwd }));
  if (pkg.version !== ALPHA_VERSION || lock.version !== ALPHA_VERSION || lock.packages?.['']?.version !== ALPHA_VERSION) fail('PACKAGE_VERSION');
  const selected = selectPayloadPaths(treeRecords(commit, cwd));
  const files = new Map(selected.map(record => [record.path, Buffer.from(gitBlob(record.object, cwd))]));
  files.set('PROVENANCE.json', createProvenanceBytes({ commit, tree, sourceDateEpoch }));
  files.set('SHA256SUMS', createSha256SumsBytes(files));
  const zip = createStoredZipBytes(files);
  const evidence = createEvidenceBytes({
    commit, tree, manifestSha256: sha256(files.get('SHA256SUMS')), containerSha256: sha256(zip),
  });
  const stage = await mkdtemp(join(dirname(parent), `.${basename(parent)}.stage-`));
  try {
    await mkdir(join(stage, ROOT_NAME));
    await writeBundle(join(stage, ROOT_NAME), files);
    await writeFile(join(stage, ZIP_NAME), zip, { flag: 'wx', mode: 0o644 });
    await writeFile(join(stage, EVIDENCE_NAME), evidence, { flag: 'wx', mode: 0o644 });
    await verifyCandidate({
      bundleRoot: join(stage, ROOT_NAME), container: join(stage, ZIP_NAME),
      evidence: join(stage, EVIDENCE_NAME), cwd,
    });
    await rename(stage, parent);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  return Object.freeze({ bundleRoot: join(parent, ROOT_NAME), container: join(parent, ZIP_NAME), evidence: join(parent, EVIDENCE_NAME), commit, tree });
}

function loopbackHost(host) {
  return /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host ?? '');
}
export function createStaticServer({ bundleRoot }) {
  const root = resolve(bundleRoot);
  const manifest = readFileSync(join(root, 'SHA256SUMS'), 'utf8');
  const allowed = new Set(manifest.trimEnd().split('\n').map(row => row.slice(66)));
  allowed.add('SHA256SUMS');
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (!loopbackHost(request.headers.host) || !['GET', 'HEAD'].includes(request.method)) fail('REQUEST_REJECTED');
      const rawTarget = request.url ?? '';
      const rawPath = rawTarget.split(/[?#]/, 1)[0];
      let decodedRawPath;
      try { decodedRawPath = decodeURIComponent(rawPath); } catch { fail('REQUEST_REJECTED'); }
      if (decodedRawPath.includes('\\') || decodedRawPath.split('/').includes('..')) fail('REQUEST_REJECTED');
      const url = new URL(rawTarget, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api') || url.hash
          || url.searchParams.getAll('enable-sw').includes('1')) fail('REQUEST_REJECTED');
      const pathname = SPA_ROUTES.has(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!safePath(pathname) || pathname.split('/').some(part => part.startsWith('.')) || !allowed.has(pathname)) fail('NOT_FOUND');
      const target = resolve(root, ...pathname.split('/'));
      if (!target.startsWith(`${root}${sep}`)) fail('REQUEST_REJECTED');
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) fail('NOT_FOUND');
      response.writeHead(200, { 'Content-Type': MIME.get(extname(target)) ?? 'application/octet-stream' });
      if (request.method === 'HEAD') response.end();
      else createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(error.message === 'NOT_FOUND' ? 404 : 403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.message === 'NOT_FOUND' ? 'Not Found' : 'Forbidden');
    }
  });
}

function argsAfterDoubleDash(argv) { return argv[0] === '--' ? argv.slice(1) : argv; }
function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) fail(`OPTION_REQUIRED:${name}`);
  return args[index + 1];
}
async function main(argv) {
  const [command, ...args] = argsAfterDoubleDash(argv);
  if (command === 'build') {
    const result = await buildCandidate({ outputParent: option(args, '--output-parent') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (command === 'verify') {
    const result = await verifyCandidate({ bundleRoot: option(args, '--bundle-root'), container: option(args, '--container') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (command === 'serve') {
    const bundleRoot = option(args, '--bundle-root');
    await verifyCandidate({ bundleRoot, container: join(dirname(resolve(bundleRoot)), ZIP_NAME) });
    const portIndex = args.indexOf('--port');
    const port = portIndex < 0 ? 0 : Number(args[portIndex + 1]);
    const server = createStaticServer({ bundleRoot });
    server.listen(port, '127.0.0.1', () => process.stdout.write(`${JSON.stringify(server.address())}\n`));
  } else fail('COMMAND_REQUIRED');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
