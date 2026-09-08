#!/usr/bin/env node
/**
 * generate-content.mjs — 从项目文件自动生成官网内容数据。
 *
 * 扫描 .apm/（skills / agents / instructions / hooks）+ Readme.md + apm.yml，
 * 输出 src/generated/content.json 供官网构建时打包。
 * 官网 CI 在每次 push 时重新执行本脚本，实现「内容物预览自动化从项目文件生成」。
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'generated', 'content.json');

const GITHUB_BASE = 'https://github.com/john-walks-slow/rabbit-skills';
const BRANCH = 'master';

/** 三大核心工作流（官网重点展示顺序） */
const CORE_ORDER = ['workflow-research-plan', 'workflow-troubleshoot', 'workflow-implement-review'];

// ---------- helpers ----------

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

/** 解析 Readme 中的 markdown 表格 → [{ cells: [..] }]（按表隔离，空行/非表行即断） */
function parseMdTable(md, headerRegex) {
  const rows = [];
  let capturing = false;
  for (const line of md.split('\n')) {
    const isRow = /^\|.*\|$/.test(line.trim());
    const isSeparator = /^\|[\s:-]+\|[\s:|-]*$/.test(line.trim());
    if (!isRow) {
      capturing = false; // 表格结束（空行或正文）
      continue;
    }
    if (isSeparator) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (headerRegex.test(cells[0] || '')) {
      capturing = true;
      continue;
    }
    if (capturing && cells[0]) rows.push(cells);
  }
  return rows;
}

const clean = (s) => (s || '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
const countLines = (s) => s.split('\n').length;

async function safeRead(p) {
  return (await readFile(p, 'utf8')).replace(/\r\n/g, '\n');
}

// ---------- main ----------

async function main() {
  const apmYml = await safeRead(join(ROOT, 'apm.yml'));
  const readme = await safeRead(join(ROOT, 'Readme.md'));

  const version = (apmYml.match(/^version:\s*(.+)$/m) || [])[1]?.trim() || '';
  const tm = apmYml.match(/^targets:\s*\n((?:\s+-\s+\S+\s*\n)+)/m);
  const targets = tm ? [...tm[1].matchAll(/-\s*(\S+)/g)].map((r) => r[1]) : [];

  // Readme 表格索引
  const skillTable = parseMdTable(readme, /^技能$/);
  const agentTable = parseMdTable(readme, /^名称$/);
  const hookTable = parseMdTable(readme, /^文件$/);

  const readmeSkill = new Map(skillTable.map((c) => [clean(c[0]), { activation: clean(c[1]) }]));
  const readmeAgent = new Map(agentTable.map((c) => [clean(c[0]), { kind: clean(c[1]), desc: clean(c[2]) }]));
  const readmeHook = new Map(hookTable.map((c) => [clean(c[0]).replace(/\.mjs$/, ''), { event: clean(c[1]), desc: clean(c[2]) }]));

  const items = [];

  // ---- Skills ----
  const skillDirs = await readdir(join(ROOT, '.apm', 'skills'), { withFileTypes: true });
  for (const d of skillDirs.filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const p = join(ROOT, '.apm', 'skills', d, 'SKILL.md');
    if (!existsSync(p)) continue;
    const raw = await safeRead(p);
    const { meta, body } = parseFrontmatter(raw);
    const readmeInfo = readmeSkill.get(d) || {};
    items.push({
      id: d,
      type: 'skill',
      name: meta.name || d,
      description: meta.description || readmeInfo.desc || '',
      activation: readmeInfo.activation || (meta['user-invocable'] === 'false' ? '仅用户' : '用户或 AI'),
      userInvocable: meta['user-invocable'] === 'true',
      path: relative(ROOT, p),
      url: `${GITHUB_BASE}/blob/${BRANCH}/${relative(ROOT, p)}`,
      lines: countLines(raw),
      content: body.trim(),
      core: CORE_ORDER.indexOf(d) >= 0 ? CORE_ORDER.indexOf(d) + 1 : undefined,
    });
  }

  // ---- Agents ----
  const agentFiles = (await readdir(join(ROOT, '.apm', 'agents'))).filter((f) => f.endsWith('.agent.md')).sort();
  for (const f of agentFiles) {
    const p = join(ROOT, '.apm', 'agents', f);
    const raw = await safeRead(p);
    const { meta, body } = parseFrontmatter(raw);
    const info = readmeAgent.get(meta.name || f.replace('.agent.md', '')) || {};
    items.push({
      id: f.replace('.agent.md', ''),
      type: 'agent',
      name: meta.name || f.replace('.agent.md', ''),
      description: meta.description || info.desc || '',
      mode: meta.mode || info.kind || '',
      path: relative(ROOT, p),
      url: `${GITHUB_BASE}/blob/${BRANCH}/${relative(ROOT, p)}`,
      lines: countLines(raw),
      content: body.trim(),
    });
  }

  // ---- Instructions ----
  const instrFiles = (await readdir(join(ROOT, '.apm', 'instructions'))).filter((f) => f.endsWith('.instructions.md')).sort();
  for (const f of instrFiles) {
    const p = join(ROOT, '.apm', 'instructions', f);
    const raw = await safeRead(p);
    const { meta, body } = parseFrontmatter(raw);
    items.push({
      id: f.replace('.instructions.md', ''),
      type: 'instruction',
      name: f.replace('.instructions.md', ''),
      description: meta.description || '',
      path: relative(ROOT, p),
      url: `${GITHUB_BASE}/blob/${BRANCH}/${relative(ROOT, p)}`,
      lines: countLines(raw),
      content: body.trim(),
    });
  }

  // ---- Hooks ----
  const hookFiles = (await readdir(join(ROOT, '.apm', 'hooks'))).filter((f) => f.endsWith('.json')).sort();
  for (const f of hookFiles) {
    const p = join(ROOT, '.apm', 'hooks', f);
    const raw = await safeRead(p);
    const id = f.replace('.json', '');
    const info = readmeHook.get(id) || {};
    const events = [...raw.matchAll(/"(SessionStart|PreToolUse|PostToolUse|Stop|UserPromptSubmit|Notification)"/g)].map((m) => m[1]);
    const mjsPath = join(ROOT, '.apm', 'hooks', `${id}.mjs`);
    const src = existsSync(mjsPath) ? await safeRead(mjsPath) : '';
    const fence = '```';
    items.push({
      id,
      type: 'hook',
      name: id,
      description: info.desc || '',
      events: [...new Set(events)],
      path: relative(ROOT, p),
      url: `${GITHUB_BASE}/blob/${BRANCH}/${relative(ROOT, p)}`,
      lines: countLines(src || raw),
      content: [
        info.event ? `**触发事件**：${info.event}\n` : '',
        src
          ? `**脚本源码**（\`${id}.mjs\`）：\n\n` + fence + 'javascript\n' + src.trim() + '\n' + fence
          : fence + 'json\n' + raw.trim() + '\n' + fence,
      ].filter(Boolean).join('\n\n'),
    });
  }

  // ---- Readme 本体（作为一项内容物） ----
  items.unshift({
    id: 'readme',
    type: 'readme',
    name: 'Readme.md',
    description: '项目总览：原则、安装、使用方式与 FAQ。',
    path: 'Readme.md',
    url: `${GITHUB_BASE}/blob/${BRANCH}/Readme.md`,
    lines: countLines(readme),
    content: readme.replace(/^# rabbit-skills\r?\n/, '').trim(),
  });

  // ---- 排序：核心工作流置顶（用户指定顺序），其余保持 Readme/目录序 ----
  const core = CORE_ORDER.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  core.forEach((i) => (i.core = CORE_ORDER.indexOf(i.id) + 1));
  const rest = items.filter((i) => !CORE_ORDER.includes(i.id));
  // Readme 中的 skill 顺序为权威顺序
  const readmeOrder = skillTable.map((c) => clean(c[0]));
  rest.sort((a, b) => {
    const ai = readmeOrder.indexOf(a.id), bi = readmeOrder.indexOf(b.id);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  const ordered = [items.find((i) => i.id === 'readme'), ...core, ...rest.filter((i) => i.id !== 'readme')];

  const totalLines = ordered.reduce((s, i) => s + i.lines, 0);
  const counts = {
    skill: ordered.filter((i) => i.type === 'skill').length,
    agent: ordered.filter((i) => i.type === 'agent').length,
    instruction: ordered.filter((i) => i.type === 'instruction').length,
    hook: ordered.filter((i) => i.type === 'hook').length,
  };

  const data = {
    version,
    targets,
    generatedAt: new Date().toISOString().slice(0, 10),
    counts,
    total: ordered.length - 1, // 不计 readme
    totalLines,
    items: ordered,
  };

  await mkdir(dirname(OUT), { recursive: true }); // fresh checkout 时目录不存在
  await writeFile(OUT, JSON.stringify(data) + '\n', 'utf8');
  console.log(
    `[content] v${version} · ${counts.skill} skills · ${counts.agent} agents · ${counts.instruction} instructions · ${counts.hook} hooks · ${totalLines} lines → ${relative(ROOT, OUT)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
