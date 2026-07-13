#!/usr/bin/env node
import { mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const RELEASE_DIR = `${ROOT}release`;

const TARGET_FILE = {
  cursor:   'AGENTS.md',
  opencode: 'AGENTS.md',
  codex:    'AGENTS.md',
  windsurf: 'AGENTS.md',
  kiro:     'AGENTS.md',
  claude:   'CLAUDE.md',
  gemini:   'GEMINI.md',
  copilot:  '.github/copilot-instructions.md',
  antigravity: 'AGENTS.md',
};

const yml = readFileSync(`${ROOT}apm.yml`, 'utf8');
const m = yml.match(/^targets:\s*\n((?:\s+-\s+\S+\s*\n)+)/m);
const targets = m
  ? [...m[1].matchAll(/-\s*(\S+)/g)].map(r => r[1])
  : Object.keys(TARGET_FILE);

console.log(`Building release for targets: ${targets.join(', ')}\n`);

for (const target of targets) {
  const outDir = `${RELEASE_DIR}/${target}`;

  console.log(`  [${target}] → ${outDir}/`);

  if (existsSync(outDir)) {
    await rm(outDir, { recursive: true });
  }
  await mkdir(outDir, { recursive: true });

  await cp(`${ROOT}.apm`, `${outDir}/.apm`, { recursive: true });
  await cp(`${ROOT}apm.yml`, `${outDir}/apm.yml`);

  execSync(`apm install -t ${target}`, { cwd: outDir, stdio: 'pipe' });
  execSync(`apm compile -t ${target}`, { cwd: outDir, stdio: 'pipe' });

  await rm(`${outDir}/.apm`, { recursive: true, force: true });
  await rm(`${outDir}/apm_modules`, { recursive: true, force: true });
  await rm(`${outDir}/apm.lock.yaml`, { force: true });
  await rm(`${outDir}/.gitignore`, { force: true });

  const ctxFile = TARGET_FILE[target];
  if (ctxFile) {
    const exists = existsSync(`${outDir}/${ctxFile}`);
    console.log(`    ${exists ? '✓' : '○'} ${ctxFile} (${exists ? 'generated' : 'rules deploy only'})`);
  }
}

console.log(`\nDone. Release ready at release/<target>/`);
console.log(`  APM users:   cd release/<target> && apm install -g`);
console.log(`  No-APM:      copy tool-specific dirs (e.g. .cursor/, .claude/) to your project`);
