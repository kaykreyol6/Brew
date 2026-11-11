#!/usr/bin/env node
/** Syntax-check every JS module (no bundler needed). */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(m?js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...(await walk('src')), ...(await walk('scripts')), ...(await walk('tests'))];
for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
console.log(`✓ ${files.length} files parsed`);
