import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const privatePathPatterns = [
  /^local-data\//,
  /^private-data\//,
  /^baseline-evidence\//,
  /^exports\/private\//,
  /^tests\/fixtures\/private\//,
  /(^|\/)\.env\.worktree$/,
  /(^|\/)worktree\.local\.json$/,
];

const privateEnvironmentPattern = /(^|\/)\.env(?:\.|$)/;
const allowedEnvironmentFiles = new Set(['.env.example']);
const sportsExportPattern = /\.(fit|tcx|gpx|zip)$/i;
const syntheticFixturePrefix = 'tests/fixtures/synthetic/';
const trackedTextExtensions = new Set([
  '.css', '.csv', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.svg',
  '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const trackedTextFileNames = new Set(['.env.example']);
const forbiddenIdentityDigests = new Set([
  'd197826b0e9da2a20d7be61f043731d65c85b4556f9b2e5212ed2d19117230ae',
  '2717176971c948ffa3370c256f3c0ce28cc94633d2cf78c917a93db77ba03fee',
  'cbf2e15d06c06d96fa4e5be73aa8fdc9287aa6f50090cf3a278e239e298af19b',
  '0ae708314479f2bf73f8f520054898ae470d6010fb6a5ea3b243465e5be21ceb',
  '603ef1c186b89e88e6e8b4e24c0386a1e601f0c78f6d98838f2c8e31c80486c7',
  'afbae1dac649e239bc3647d751ec40b73758d14272640764b438e95db2c632b9',
  'd74738e262dc4ca990b1e9e05b6769b299be61f1c0ac92275bb43e795276e9cb',
  '2184a4e3f4ce0f213448243fb42d24df4b7763ce99f5fedd2e73b45194774678',
]);
const identityStructurePatterns = Object.freeze([
  Object.freeze({
    pattern: /\bTARGET_ATHLETE_ID\b/,
    reason: 'hard-coded athlete identity selector',
  }),
  Object.freeze({
    pattern: /\b(?:Number|parseInt|parseFloat|BigInt)\s*\(\s*(?:profile|athlete|activity)(?:\?\.)?\.id\b/,
    reason: 'opaque identity numeric coercion',
  }),
  Object.freeze({
    pattern: /\bparseInt\s*\(\s*activityId\b/,
    reason: 'opaque activity ID numeric parsing',
  }),
]);
const privateLocationPatterns = Object.freeze([
  Object.freeze({
    pattern: /\/Users\//,
    reason: 'personal macOS home path',
  }),
  Object.freeze({
    pattern: /\.codex[\\/]worktrees[\\/]/,
    reason: 'Codex worktree identifier path',
  }),
  Object.freeze({
    pattern: /\bStravaStats-private(?:-data)?(?:[\\/]|$)/i,
    reason: 'private evidence directory path',
  }),
]);

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return output.split('\0').filter(Boolean);
}

function findViolation(file) {
  if (privatePathPatterns.some(pattern => pattern.test(file))) {
    return 'private path must not be tracked';
  }

  if (privateEnvironmentPattern.test(file) && !allowedEnvironmentFiles.has(file)) {
    return 'environment file must not be tracked';
  }

  if (sportsExportPattern.test(file) && !file.startsWith(syntheticFixturePrefix)) {
    return 'sports export must be an explicitly synthetic test fixture';
  }

  return null;
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function identityCandidates(content) {
  const candidates = new Set(content.match(/[A-Za-z0-9_.@-]{3,}/g) ?? []);
  for (const pattern of [
    /'((?:\\.|[^'\\])*)'/g,
    /"((?:\\.|[^"\\])*)"/g,
    /`((?:\\.|[^`\\])*)`/g,
  ]) {
    for (const match of content.matchAll(pattern)) candidates.add(match[1]);
  }
  return candidates;
}

export function findContentViolation(
  file,
  content,
  identityDigests = forbiddenIdentityDigests,
) {
  if (!trackedTextFileNames.has(file)
    && !trackedTextExtensions.has(extname(file).toLowerCase())) return null;
  for (const { pattern, reason } of privateLocationPatterns) {
    if (pattern.test(content)) return reason;
  }
  for (const { pattern, reason } of identityStructurePatterns) {
    if (pattern.test(content)) return reason;
  }
  for (const candidate of identityCandidates(content)) {
    if (identityDigests.has(digest(candidate))) {
      return 'tracked athlete identity literal';
    }
  }
  return null;
}

export function scanTrackedFiles(files = listTrackedFiles()) {
  const violations = [];
  for (const file of files) {
    const pathViolation = findViolation(file);
    if (pathViolation) {
      violations.push({ file, reason: pathViolation });
      continue;
    }
    if (!trackedTextExtensions.has(extname(file).toLowerCase())) continue;
    const contentViolation = findContentViolation(file, readFileSync(file, 'utf8'));
    if (contentViolation) violations.push({ file, reason: contentViolation });
  }
  return violations;
}

export function createIdentityDigest(value) {
  return digest(value);
}

function run() {
  const violations = scanTrackedFiles();
  if (violations.length > 0) {
    console.error('Privacy check failed:');
    for (const { file, reason } of violations) {
      console.error(`- ${file}: ${reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Privacy check passed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
