/**
 * Runtime 目标清单 —— release 构建与官网展示的唯一来源。
 *
 * 注意：只有 USER_SCOPE_TARGETS 能写进 apm.yml 的 targets。
 * APM 在用户级安装（`apm install -g` / `apm update -g`）时按自己的白名单校验
 * 包声明的 targets，遇到没有用户级部署目录（或需实验性开关）的 runtime 会直接
 * 报 `Unknown target` 并让整次安装失败——即使调用方用 -t 指定了合法目标。
 */

export const RUNTIME_TARGETS = [
  'copilot',
  'claude',
  'cursor',
  'opencode',
  'codex',
  'gemini',
  'windsurf',
  'kiro',
  'antigravity',
  'copilot-app',
  'copilot-cowork',
  'grok-build',
  'grok-cloud',
  'hermes',
  'intellij',
  'openclaw',
  'vscode',
  'agents',
  'agent-skills',
];

/** APM 用户级安装不支持声明的 runtime（无用户级目录，或依赖实验性开关）。 */
const USER_SCOPE_UNSUPPORTED = new Set([
  'agents',
  'copilot-app',
  'copilot-cowork',
  'grok-cloud',
  'intellij',
  'openclaw',
]);

/** 可写入 apm.yml targets 的 runtime，供 `apm install -g` 使用。 */
export const USER_SCOPE_TARGETS = RUNTIME_TARGETS.filter((t) => !USER_SCOPE_UNSUPPORTED.has(t));
