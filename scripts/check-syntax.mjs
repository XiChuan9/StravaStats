import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const ignoredDirs = new Set(['node_modules', '.git', '.vercel']);
const targetExtensions = new Set(['.js', '.mjs']);

function collectFiles(dir, acc = []) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      collectFiles(fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!targetExtensions.has(path.extname(entry.name))) continue;

    acc.push(fullPath);
  }

  return acc;
}

const files = collectFiles(rootDir);
if (files.length === 0) {
  console.error('No JS/MJS files found for syntax check.');
  process.exit(1);
}

let hasErrors = false;

for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    hasErrors = true;
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} files.`);
