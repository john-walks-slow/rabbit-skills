/**
 * docs.ts — 文档章节交互：标签切换文档类型，展示样本与「记录/不记录」。
 *
 * 文档类型取自 .apm/instructions/03_documentation.instructions.md 的真实类型，
 * 样例内容仿照对应 skill 的实际产出。
 */
interface DocType {
  path: string;
  purpose: string;
  records: string;
  not: string;
  body: string;
}

const DOCS: Record<string, DocType> = {
  agents: {
    path: 'AGENTS.md',
    purpose: '项目级指引。任何工作前必读——目标、地图、约定、红线。更新规则见 /update-project-instruction。',
    records: '项目目标、模块地图、开发与测试约定、红线',
    not: '逐文件说明、API 文档',
    body: `<span class="md-cm"># AGENTS.md · 项目指引</span>

<span class="md-h">## 目标</span>
轻量 Agent 配置套件，兼容主流 Agent 工具。

<span class="md-h">## 地图</span>
- .apm/ — skills / agents / hooks / instructions
- website/ — 官网（Vite + GSAP）
- scripts/ — 构建 / 发布

<span class="md-h">## 开发约定</span>
- 提交前必走 commit-own-changes（git-lock）
- 禁止 git stash/checkout/reset --hard
- 动效：transform/opacity only，prefers-reduced-motion 兜底

<span class="md-h">## 红线</span>
- 不往 rootfs /dev /proc /sys mknod
- 实机验证由用户负责，不硬搞`,
  },
  research: {
    path: 'docs/features/260915-memory/260915-memory.research.md',
    purpose: '调研发现与外部方案。设计前由 /workflow-research-plan 调研阶段产出，喂给 plan.md。',
    records: '调研发现、外部方案对比、关键结论',
    not: '最终设计决策（在 plan.md）',
    body: `<span class="md-cm"># 260915 · Agent 记忆 调研</span>

<span class="md-h">## 现状</span>
- 会话间无记忆，用户偏好与项目决策每次重述
- 无现成跨会话记忆接入

<span class="md-h">## 外部方案</span>
- Mnemon：语义检索 + 图谱关系，需 embedding
- mem0：轻量 key-value，无图谱
- 两者均需 embedding 服务；本机 mihomo 出口可走

<span class="md-h">## 关键结论</span>
- 倾向 Mnemon：图谱关系对「决策溯源」更有价值
- embedding 走本地垫片避代理超时`,
  },
  plan: {
    path: 'docs/features/260915-memory/260915-memory.plan.md',
    purpose: '调研结论 + 架构方案 + 待对齐点。由 /workflow-research-plan 产出，对齐后才动手。',
    records: '调研结论、方案选型与理由、开放问题',
    not: '代码实现细节、逐行步骤',
    body: `<span class="md-cm"># 260915 · Agent 记忆功能</span>

<span class="md-h">## 目标</span>
为 Agent 接入跨会话记忆，记住用户偏好与项目决策。

<span class="md-h">## 调研结论</span>
见 research.md。倾向 Mnemon，embedding 走本地垫片。

<span class="md-h">## 方案</span>
1. 接入 Mnemon Native，embedding 指向本地垫片 127.0.0.1:8765
2. 写入：偏好 → USER.md；决策 → MEMORY.md
3. 读取：每会话注入快照，按需深度 recall

<span class="md-h">## 待对齐</span>
- [ ] 记忆容量满时归档策略由用户审阅否决？
- [ ] 是否记录所有子代理产出？`,
  },
  validation: {
    path: 'docs/features/260915-memory/260915-memory.validation.md',
    purpose: '核心场景 + 必须实机验证项。由 /update-validation-requirements 产出，用户实机签字。',
    records: '验证步骤、预期、实际结果、状态',
    not: '测试代码、覆盖率数据',
    body: `<span class="md-cm"># 260915 · Agent 记忆 验证</span>

<span class="md-h">## 验证说明</span>
- 对象：跨会话记忆（写入 + 注入 + recall）
- 环境：本机容器

<span class="md-h">## 验证项</span>

| 步骤 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 说一次偏好，新会话是否记得 | 自动应用 | | 待验证 |
| recall 查一周前决策 | 命中相关条目 | | 待验证 |
| 容量满触发归档 | 不阻塞会话 | | 待验证 |

<span class="md-h">## 验证结论</span>
待验证。`,
  },
  troubleshoot: {
    path: 'docs/issues/260915-mnemon-timeout/260915-mnemon-timeout.troubleshoot.md',
    purpose: '根因 + 修复路径。由 /workflow-troubleshoot 产出，只留结论与根因，不记排查全过程。',
    records: '现象、根因、修复方案',
    not: '排查的试错过程、被否定的假设',
    body: `<span class="md-cm"># 260915 · mnemon 超时</span>

<span class="md-h">## 现象</span>
dsh-mnemon 报 "mnemon did not respond within 10000ms"，
偶发，长会话更频繁。

<span class="md-h">## 根因</span>
两层叠加：
1. embedding 走 mihomo 出口，偶发 20s+ 离群 → 撞插件 10s 硬超时
2. MEMORY.md 容量满触发归档 import（批量 embedding）必超 10s

<span class="md-h">## 修复</span>
- embedding endpoint 指向本地垫片 127.0.0.1:8765（不走代理）
- mnemon.timeoutMs 提至 60000
- 已验证：连续 50 次 recall 无超时`,
  },
  e2e: {
    path: 'docs/features/260915-memory/260915-memory.e2e.md',
    purpose: '端到端测试报告。由 /spawn-e2e-tester 派发的子代理产出，覆盖核心真实场景。',
    records: '测试步骤、预期、实际、状态、证据',
    not: '单元测试、覆盖率数据',
    body: `<span class="md-cm"># 260915 · Agent 记忆 E2E 测试</span>

<span class="md-h">## 测试环境</span>
- 环境：本机容器，claude code + mnemon

<span class="md-h">## 测试项</span>

| # | 步骤 | 预期 | 实际 | 状态 |
|---|------|------|------|------|
| 1 | 说偏好后开新会话 | 记得并应用 | 记得 | 通过 |
| 2 | recall 一周前决策 | 命中相关 | 命中 | 通过 |
| 3 | 容量满触发归档 | 不阻塞 | 不阻塞 | 通过 |

<span class="md-h">## 结论</span>
- 通过：3 · 不通过：0 · 受阻：0
- 总体：通过`,
  },
};

const ORDER = ['agents', 'research', 'plan', 'validation', 'troubleshoot', 'e2e'];

export function initDocsTabs() {
  const root = document.getElementById('docs-tabs')!;
  const panel = document.getElementById('docs-panel')!;
  if (!root || !panel) return;

  const elPath = document.getElementById('docs-path');
  const elPurpose = document.getElementById('docs-purpose');
  const elRecords = document.getElementById('docs-records');
  const elNot = document.getElementById('docs-not');
  const elPreview = document.getElementById('docs-preview');

  function show(key: string) {
    const d = DOCS[key];
    if (!d) return;
    swapWithFade(panel, () => {
      if (elPath) elPath.textContent = d.path;
      if (elPurpose) elPurpose.textContent = d.purpose;
      if (elRecords) elRecords.textContent = d.records;
      if (elNot) elNot.textContent = d.not;
      if (elPreview) elPreview.innerHTML = d.body;
    });
    root.querySelectorAll('.docs-tab').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-doc') === key);
    });
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.docs-tab') as HTMLElement | null;
    if (!btn) return;
    const key = btn.getAttribute('data-doc');
    if (key) show(key);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cur = root.querySelector('.docs-tab.is-active') as HTMLElement | null;
    const idx = cur ? ORDER.indexOf(cur.getAttribute('data-doc')!) : 0;
    const next = e.key === 'ArrowRight' ? (idx + 1) % ORDER.length : (idx - 1 + ORDER.length) % ORDER.length;
    show(ORDER[next]);
    (root.children[next] as HTMLElement)?.focus();
  });

  show('agents');
}

function swapWithFade(panel: HTMLElement, swap: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { swap(); return; }
  panel.style.opacity = '0';
  panel.style.transition = 'opacity 0.18s ease';
  setTimeout(() => {
    swap();
    panel.style.opacity = '1';
  }, 180);
}
