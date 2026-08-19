import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_SCOPE_FREEZE_BASE =
  '6924e7c77036c9a743f908936a28a2719936b726';

export const PUBLIC_SCOPE_FREEZE_BRANCH = 'codex/public/local-import-core';

// This is intentionally a literal, code-owned contract. Do not derive the
// allowlist from the Task Brief at runtime: a documentation-only edit must not
// be able to authorize another changed path in the same patch.
export const PUBLIC_SCOPE_FREEZE_ALLOWED_PATHS = Object.freeze([
  'docs/tasks/public-local-import-core-freeze.md',
  '.github/workflows/ci.yml',

  'index.html',
  'js/app/main.js',
  'js/tabs/AGENTS.md',
  'js/tabs/index.js',
  'js/tabs/run-plus.js',
  'styles/run-plus.css',
  'scripts/local-dev-server.mjs',
  'scripts/alpha-candidate.mjs',
  'scripts/check-privacy.mjs',
  'scripts/check-public-scope-freeze.mjs',

  'tests/public/local-import-core-freeze.test.js',
  'tests/consumers/detail-boundaries.test.js',
  'tests/consumers/run-plus-canonical-browser-smoke.html',
  'tests/consumers/run-plus-canonical-cutover.test.js',
  'tests/consumers/run-plus-consumers.test.js',
  'tests/consumers/run-plus.test.js',
  'tests/consumers/summary-boundaries.test.js',
  'tests/consumers/summary-browser-smoke.html',
  'tests/consumers/summary-consumers.test.js',
  'tests/default-canonical-browser-smoke.html',
  'tests/default-canonical.test.js',
  'tests/docs/release-docs.test.js',
  'tests/legacy/demo-isolation.test.js',
  'tests/pages/main.test.js',
  'tests/privacy/client-logging.test.js',
  'tests/privacy/root-privacy-disclosure.test.js',
  'tests/privacy/tracked-identity.test.js',
  'tests/release/alpha-candidate.test.js',
  'tests/server/local-dev-server.test.js',
  'tests/shadow/shadow-boundaries.test.js',

  'README.md',
  'CHANGELOG.md',
  'docs/README.md',
  'docs/architecture/overview.md',
  'docs/baseline/README.md',
  'docs/engineering/git-worktree-workflow.md',
  'docs/engineering/release-gates.md',
  'docs/engineering/v2-development-plan.md',
  'docs/guides/known-limitations.md',
  'docs/guides/migration-guide.md',
  'docs/guides/privacy-guide.md',
  'docs/product/stravastats-v2-prd.md',
  'docs/tasks/0000-v2-documentation-baseline.md',
  'docs/tasks/README.md',
  'docs/tasks/pr-00-repository-safety.md',
  'docs/tasks/pr-01-legacy-cache-rescue.md',
  'docs/tasks/pr-02-canonical-contracts.md',
  'docs/tasks/pr-03-legacy-repository.md',
  'docs/tasks/pr-04a-summary-consumers.md',
  'docs/tasks/pr-04b-detail-consumers.md',
  'docs/tasks/pr-04c-run-plus-consumers.md',
  'docs/tasks/pr-05-indexeddb-v2-schema.md',
  'docs/tasks/pr-06-shadow-canonical-writer.md',
  'docs/tasks/pr-07-import-core.md',
  'docs/tasks/pr-08-activities-csv.md',
  'docs/tasks/pr-09-strava-zip.md',
  'docs/tasks/pr-10-source-manager.md',
  'docs/tasks/pr-11-fit-decoder.md',
  'docs/tasks/pr-12-tcx-decoder.md',
  'docs/tasks/pr-13-gpx-decoder.md',
  'docs/tasks/pr-14-decoder-registry.md',
  'docs/tasks/pr-15-local-first-bootstrap.md',
  'docs/tasks/pr-16-canonical-summary-cutover.md',
  'docs/tasks/pr-17-canonical-detail-cutover.md',
  'docs/tasks/pr-18-run-plus-nsm-cutover.md',
  'docs/tasks/pr-19-exact-identity.md',
  'docs/tasks/pr-22-diagnostics-performance.md',
  'docs/tasks/pr-23-default-canonical.md',
  'docs/tasks/pr-24-release-documentation.md',
  'docs/tasks/pr-26-dom-safety.md',
  'docs/tasks/pr-27-detail-output-hardening.md',
  'docs/tasks/pr-28-identity-redaction.md',
  'docs/tasks/pr-30-client-log-redaction.md',
  'docs/tasks/pr-35-ai-coach-consent.md',
  'docs/tasks/pr-36-map-location-boundary.md',
  'docs/tasks/pr-39-root-privacy-disclosure.md',
  'docs/tasks/pr-41-source-manager-connection-controller.md',
  'docs/tasks/pr-42-source-connection-identity-backup.md',
  'docs/tasks/pr-43a-provider-bundle-mapper.md',
  'docs/tasks/pr-43b-provider-artifact-import.md',
  'docs/tasks/pr-47-final-v2-release-roadmap.md',
  'docs/tasks/pr-48-alpha-contract.md',
  'docs/tasks/pr-49-alpha-candidate-planning.md',
  'docs/tasks/pr-50-analysis-profile.md',
  'docs/tasks/pr-53-real-import-consumer-numeric-hardening.md',
  'docs/tasks/pr-54-global-map-canonical-routes.md',
  'docs/testing/regression-matrix.md',
  'docs/testing/fixture-policy.md',
  'docs/testing/public-local-import-core-browser-acceptance.md',
]);

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

export function findUnlistedScopeChanges(paths) {
  const allowed = new Set(PUBLIC_SCOPE_FREEZE_ALLOWED_PATHS);
  return [...new Set(paths)]
    .filter(path => !allowed.has(path))
    .sort();
}

export function resolveScopeFreezeBranch({
  env = process.env,
  cwd = process.cwd(),
  execFile = execFileSync,
} = {}) {
  if (env.GITHUB_ACTIONS === 'true') {
    return typeof env.GITHUB_HEAD_REF === 'string'
      ? env.GITHUB_HEAD_REF.trim()
      : '';
  }

  try {
    return execFile('git', ['branch', '--show-current'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function isPublicScopeFreezeBranch(options) {
  return resolveScopeFreezeBranch(options) === PUBLIC_SCOPE_FREEZE_BRANCH;
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

  const unlisted = findUnlistedScopeChanges(changed);
  if (unlisted.length > 0) {
    console.error('Public scope-freeze unlisted-path changes detected:');
    for (const path of unlisted) console.error(`- ${path}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Public scope-freeze literal allowlist guard passed (${changed.length} paths).`,
  );
}

if (process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
