#!/usr/bin/env node
import { mkdir, cp, rm, writeFile } from 'node:fs/promises';
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
  'copilot-app': 'AGENTS.md',
  'copilot-cowork': 'AGENTS.md',
  'grok-build': 'AGENTS.md',
  'grok-cloud': 'AGENTS.md',
  hermes: 'AGENTS.md',
  intellij: 'AGENTS.md',
  openclaw: 'AGENTS.md',
  vscode: null,
  agents: 'AGENTS.md',
  'agent-skills': null,
};

const yml = readFileSync(`${ROOT}apm.yml`, 'utf8');
const m = yml.match(/^targets:\s*\n((?:\s+-\s+\S+\s*\n)+)/m);
const targets = m
  ? [...m[1].matchAll(/-\s*(\S+)/g)].map(r => r[1])
  : Object.keys(TARGET_FILE);

// APM 0.31 会校验 apm.yml 的 targets 列表，但其白名单落后于实际支持的
// runtime（agents / copilot-app / intellij 等会被误拒）。拷入各 target 目录
// 时剥掉 targets: 块，让 -t 标志完全接管 target 解析。
const ymlForTarget = yml.replace(/^targets:\s*\n(?:\s+-\s+\S+\s*\n)+/m, '');

console.log(`Building release for targets: ${targets.join(', ')}\n`);

for (const target of targets) {
  const outDir = `${RELEASE_DIR}/${target}`;

  console.log(`  [${target}] → ${outDir}/`);

  if (existsSync(outDir)) {
    await rm(outDir, { recursive: true });
  }
  await mkdir(outDir, { recursive: true });

  await cp(`${ROOT}.apm`, `${outDir}/.apm`, { recursive: true });
  await writeFile(`${outDir}/apm.yml`, ymlForTarget);

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
