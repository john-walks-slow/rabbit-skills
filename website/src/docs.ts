/**
 * docs.ts — 文档章节交互：标签切换文档类型，展示样本与「记录/不记录」。
 *
 * 意图：以 example 展示 rabbit-skills 产出的主要文档类型，
 * 表明文档在这里是为了留档（决策/证据/经验），而非重述代码。
 */
interface DocType {
  path: string;
  purpose: string;
  records: string;
  not: string;
  body: string;
}

const DOCS: Record<string, DocType> = {
  plan: {
    path: 'docs/features/260915-memory/260915-memory.plan.md',
    purpose: '调研结论 + 架构方案 + 待对齐点。实施前由调研工作流产出，对齐后才动手。',
    records: '调研发现、方案选型与理由、开放问题',
    not: '代码实现细节、逐行步骤',
    body: `<span class="md-cm"># 260915 · Agent 记忆功能</span>

<span class="md-h">## 目标</span>
为 Agent 接入跨会话记忆，记住用户偏好与项目决策。

<span class="md-h">## 调研结论</span>
- 现有方案：Mnemon（语义检索 + 图谱）、mem0（轻量 key-value）
- 两者均需 embedding 服务；本机已有 mihomo 出口可走
- 倾向 Mnemon：图谱关系对「决策溯源」更有价值

<span class="md-h">## 方案</span>
1. 接入 Mnemon Native，embedding 走本地垫片避超时
2. 写入：用户偏好 → USER.md；项目决策 → MEMORY.md
3. 读取：每会话启动注入快照，按需深度 recall

<span class="md-h">## 待对齐</span>
- [ ] 记忆容量满时的归档策略由用户审阅否决？
- [ ] 是否记录所有子代理产出？`,
  },
  validation: {
    path: '260915-memory.validation.md',
    purpose: '核心场景 + 必须实机验证项。交付前由实施工作流产出，用户实机签字。',
    records: '验证步骤、预期、实际结果、状态',
    not: '测试代码、覆盖率数据',
    body: `<span class="md-cm"># 260915 · Agent 记忆功能 验证</span>

<span class="md-h">## 验证说明</span>
- 对象：跨会话记忆（写入 + 注入 + recall）
- 环境：本机容器，claude code + mnemon

<span class="md-h">## 验证项</span>

| 步骤 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 说一次偏好，新会话是否记得 | 自动应用 | | 待验证 |
| recall 查一周前决策 | 命中相关条目 | | 待验证 |
| 容量满触发归档 | 不阻塞会话 | | 待验证 |

<span class="md-h">## 验证结论</span>
待验证。`,
  },
  diagnosis: {
    path: 'docs/issues/260915-mnemon-timeout/260915-mnemon-timeout.diagnosis.md',
    purpose: '根因 + 修复路径。由排障工作流产出，只留结论与根因，不记排查全过程。',
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
  tasks: {
    path: 'docs/tasks/260915-batch-fix/tasks.md',
    purpose: '任务梳理 + 分派跟踪。由任务分派工作流产出，只记任务与状态，不记实施。',
    records: '任务、类型、状态、分派至、产出文档',
    not: '具体实施步骤、代码',
    body: `<span class="md-cm"># 260915 · 批量修复</span>

| 任务 | 类型 | 状态 | 分派至 | 产出 |
|------|------|------|--------|------|
| 登录页崩溃 | 疑难 | 完成 | sub#1 | diagnosis.md |
| 深色模式 | 优化 | 待验证 | sub#2 | validation.md |
| 记忆接入 | 新需求 | 进行中 | sub#3 | plan.md |
| 发布脚本 | 架构 | 暂缓 | — | — |

<span class="md-cm">分派顺序：崩溃 → 优化 → 新需求 → 架构（暂缓待对齐）</span>`,
  },
  agents: {
    path: 'AGENTS.md',
    purpose: '项目/模块地图 + 红线。由项目指引技能产出，Agent 工作前必读。',
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
  lesson: {
    path: 'docs/lessons/camoufox-geoip.lesson.md',
    purpose: '可复用经验留档。一次性排查的提炼，供未来 Agent 复用，不记排查本身。',
    records: '坑、根因、修复模式、适用范围',
    not: '一次性排查的完整过程',
    body: `<span class="md-cm"># camoufox geoip 不落地</span>

<span class="md-h">## 现象</span>
camoufox-mcp 设了 proxy.geoip=true，时区仍为 UTC。

<span class="md-h">## 根因</span>
geoip 解析出时区后，需写入 env.TZ 才生效；
camoufox-mcp@1.0.0 未把解析结果回传 env，时区不落地。

<span class="md-h">## 修复模式</span>
幂等脚本 setup-camoufox-mcp-fixes.sh：
patch user config 注入 env.TZ = <resolved tz>。
npm 重装后须重跑该脚本。

<span class="md-h">## 适用</span>
camoufox-mcp@1.0.0 + camoufox-js 0.12.0 组合。
升级后若 geoip 原生落地，此 patch 可移除。`,
  },
};

const ORDER = ['plan', 'validation', 'diagnosis', 'tasks', 'agents', 'lesson'];

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
    // 淡出 → 换内容 → 淡入
    gsapFromCSS(panel, () => {
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

  // 键盘左右切换
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cur = root.querySelector('.docs-tab.is-active') as HTMLElement | null;
    const idx = cur ? ORDER.indexOf(cur.getAttribute('data-doc')!) : 0;
    const next = e.key === 'ArrowRight' ? (idx + 1) % ORDER.length : (idx - 1 + ORDER.length) % ORDER.length;
    show(ORDER[next]);
    (root.children[next] as HTMLElement)?.focus();
  });

  show('plan');
}

/** 轻量淡出换内容淡入，避免引入额外依赖 */
function gsapFromCSS(panel: HTMLElement, swap: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { swap(); return; }
  panel.style.opacity = '0';
  panel.style.transition = 'opacity 0.18s ease';
  setTimeout(() => {
    swap();
    panel.style.opacity = '1';
  }, 180);
}
