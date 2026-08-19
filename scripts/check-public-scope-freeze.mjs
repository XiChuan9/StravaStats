import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_SCOPE_FREEZE_BASE =
  '6924e7c77036c9a743f908936a28a2719936b726';

export const PROHIBITED_SCOPE_PREFIXES = Object.freeze([
  'js/data/contracts/',
  'js/decoders/fit/',
  'js/decoders/tcx/',
  'js/decoders/gpx/',
  'js/import/',
  'js/storage/',
  'js/repository/',
  'js/backup/',
  'js/connectors/',
  'js/pages/source-manager/',
  'api/',
]);

export const PROHIBITED_SCOPE_FILES = Object.freeze([
  'js/tabs/run-analysis.js',
  'package-lock.json',
  'source-manager.html',
  'storage-backup.html',
  'sw.js',
]);

function parseNullSeparated(output) {
  return output.split('\0').filter(Boolean);
}

function isLicensePath(path) {
  return /^LICENSE/i.test(path);
}

export function scopeFreezeDiffArgs(base = PUBLIC_SCOPE_FREEZE_BASE) {
  return ['diff', '--no-renames', '--name-only', '-z', base, '--'];
}

export function findProhibitedScopeChanges(paths) {
  const exact = new Set(PROHIBITED_SCOPE_FILES);
  return [...new Set(paths)]
    .filter(path => (
      exact.has(path)
      || isLicensePath(path)
      || PROHIBITED_SCOPE_PREFIXES.some(prefix => path.startsWith(prefix))
    ))
    .sort();
}

export function listScopeFreezeChanges({
  base = PUBLIC_SCOPE_FREEZE_BASE,
  cwd = process.cwd(),
} = {}) {
  const options = {
    cwd,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  const changed = parseNullSeparated(execFileSync(
    'git',
    scopeFreezeDiffArgs(base),
    options,
  ));
  const untracked = parseNullSeparated(execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z'],
    options,
  ));
  return [...new Set([...changed, ...untracked])].sort();
}

function run() {
  let changed;
  try {
    changed = listScopeFreezeChanges();
  } catch {
    console.error('Public scope-freeze guard could not inspect the fixed base.');
    process.exitCode = 1;
    return;
  }

  const prohibited = findProhibitedScopeChanges(changed);
  if (prohibited.length > 0) {
    console.error('Public scope-freeze prohibited-path changes detected:');
    for (const path of prohibited) console.error(`- ${path}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Public scope-freeze changed-path guard passed (${changed.length} paths).`,
  );
}

if (process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
