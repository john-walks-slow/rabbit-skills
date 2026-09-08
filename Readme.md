# rabbit-skills

轻量、松弛、有效的 Coding Agent 配置套件。适合中等规模的 AI 原生项目开发。

> 🌐 官网：<https://john-walks-slow.github.io/rabbit-skills/> —— 哲学、三大核心工作流的动效介绍与全部内容物在线预览。

## 原则

- 简洁清晰，相对松弛的约束，不为模型捆手捆脚。
- 零学习成本，不绑定特定开发范式（如 TDD 等，需要时再引入）。
- 通用需求开发工作流。先调研设计：Research → Plan → Align。再迭代交付：Implement → Test → Review → Validate → Documentation → Commit。
- 通用 Bugfix 工作流。先定位再修改避免越改越错。
- 任务分派工作流，跟踪问题、整理依赖关系、并行实施，并使用文档双向沟通。
- 基于子代理的调研、检视、复核，显著减少幻觉，提高交付质量。
- 正交的模式技能：`/max-effort` 最高强度、`/e2e` 端到端自测、`/delay-validation` 延迟验证。各自独立，自由组合。
- 日常实用 Skill：`commit-own-changes` 无需 worktree 实现安全的并行提交、`worktree` 物理隔离的并行开发约定、`teach-me` 把当前项目的关键设计和风险教给负责人、`tidy` 清理冗余修改、`cross-check` 审视既有结论、`handoff` 会话交接、`grilling` 盘问计划、`try` 修改前备份、`bad-smell` 识别代码坏味道、`unstuck` 连续修改未达预期时强制退一步分析。
- 化繁为简的文档规范，留存记录的同时避免历史文档-代码双向同步问题。
- 基于 [APM (Agent Package Manager)](https://microsoft.github.io/apm/) 规范，兼容主流 Agent。

## 为什么这些约束不会过时

模型在变强，提示词在贬值。这套件刻意只保留**约束「委托」这件事本身**的规则——只要你还在把工作委托给一个不完全理解你意图的执行者，它们就成立：

- 信息不对称 → 调研先于动手（Research → Plan → **Align**）
- 能力强 ≠ 不会错 → 置信闸门（95% / 85%）
- 复杂系统因果模糊 → 根因先于修复（Troubleshoot）
- 犯错者查不出自己的错 → 独立检视与子代理隔离（Reviewer / cross-check）
- 承担后果的人必须验收 → 实机验证（Validate）
- 并行会互踩 → 提交纪律与物理隔离（commit-own-changes / worktree）
- 文件修改需要逃生门 → try（备份回滚）；不可逆操作（发布、删除、外部副作用）→ 不挂账，交用户授权

它们约束的是流程，而不是模型。模型变强十倍，这些闸门依然正确——只是通过的成本变低了。而绑定具体模型能力、试图在决策现场「模拟用户」的机制，会随模型遵从性提升而逐渐失去价值，因此被本套件刻意排除。

## 单元

套件由九个正交单元组成，任何内容物恰好归属一个单元：

| 单元 | 职责 | 内容物 |
| --- | --- | --- |
| 流程 | 定义工作步骤与闸门 | workflow-research-plan / workflow-troubleshoot / workflow-implement-review |
| 时机 | 对齐闸门何时结算（现结 / 挂账） | delay-validation |
| 强度 | 质量标准 | max-effort |
| 验证 | 谁负责验收、验到什么程度 | e2e、update-validation-requirements（验证文档载体） |
| 隔离 | 借干净的脑子复核 | reviewer / deep-researcher / expert、spawn-deep-researcher / spawn-reviewer、cross-check |
| 分派 | 批量派发与跟踪 | workflow-manage-tasks |
| 工具 | 可逆性、日常杂务 | commit-own-changes、worktree、try、unstuck、grilling、tidy、handoff、bad-smell |
| 知识 | 学习与教学方法论 | teach-me、code-deep-dive、web-search-best-practice |
| 治理与基线 | 文档规范、系统指令与钩子 | update-project-instruction、update-module-instruction、update-references、Instructions（00/01/03/09）、Hooks |

模式技能（时机 / 强度 / 验证）与任何工作流正交组合：`/max-effort /e2e /delay-validation` + 任务描述，即后台长跑、完整自测、事后审计的最高自主模式。

## 安装

### A. 预构件安装

[![Release](https://img.shields.io/github/v/release/john-walks-slow/rabbit-skills?label=release)](https://github.com/john-walks-slow/rabbit-skills/releases/latest)

下载最新 release，将内容解压到对应工具配置目录即可。

### B. 通过 APM 安装

确保已安装 [APM CLI](https://microsoft.github.io/apm/getting-started/installation/)。

全局安装到所有支持的工具：

```bash
apm install -g john-walks-slow/rabbit-skills
```

如果你的工具原生不支持 Instructions / Rules（如 OpenCode、Codex、Gemini），需额外将 Instructions 编译为全局指令：

```bash
apm compile -g
```

> 注：APM 不会覆盖你原先手写的指令（AGENTS.md 等）。如果希望覆盖，请在备份后删除原有指令文件，再次执行 compile -g。

## 使用

主 Agent 的唯一入口是 Workflow Skill。

```
/workflow-research-plan 调研 Agent 记忆的 sota 方案，给我的 Agent 加上记忆功能。
```

认可计划后调用：

```
/workflow-implement-review 实施。
```

修复 Bug 时依次调用 `/workflow-troubleshoot` 和 `/workflow-implement-review`。

### 模式技能

三个正交的模式技能，可与任何工作流组合：

| 模式 | 作用 |
| --- | --- |
| `/max-effort` | 质量 > 速度，瞄准 SOTA 反复迭代，重活委托子代理保持主上下文整洁 |
| `/e2e` | 交付前由 Agent 完成完整端到端自测，仅用户可验的项目留档汇总 |
| `/delay-validation` | 对齐闸门挂账：Agent 按最佳判断自主通过，决策记入台账，交付时输出审计包 |

后台长跑无人值守的完整组合：

```
/max-effort /e2e /delay-validation 调研并实现 XX 功能，完成后输出审计包。
```

### 任务分派

如果你有许多略显杂乱的任务，可以使用任务分派工作流，由 AI 为你梳理和分配工作给子代理实施。
调用 `/workflow-manage-tasks`，然后描述任务。
AI 会为你整理待办事项、在 tasks.md 中跟踪进度、在任务开始执行前与你对齐计划，并在子代理阶段性工作完成需要评估时与你沟通。

> 注：`/workflow-manage-tasks` 仅推荐拥有后台运行 Subagent 以及 延续 Subagent 会话能力的 AI 工具使用。

> 注：网络搜索能力对计划与实施质量有着最大的影响。请确保 Agent 具有完全的网络搜索和访问能力（例如：通过 exa，jina 等服务）。

## 内容物

### Instructions（系统指令）

| 文件               | 说明     |
| ------------------ | -------- |
| `00_output_style`  | 输出风格 |
| `01_coding_style`  | 编码规范 |
| `03_documentation` | 文档规范 |
| `09_custom`        | 其他惯例 |

### Agents（子代理）

| 名称              | 说明     |
| ----------------- | -------- |
| `deep-researcher` | 网络调研 |
| `reviewer`        | 代码检视 |
| `expert`          | 通用困难任务的高判断力分析 |

### Skills & Commands（技能与命令）

| 技能                             | 激活方式  | 说明                                                                          |
| -------------------------------- | --------- | ----------------------------------------------------------------------------- |
| `workflow-research-plan`         | 用户或 AI | 调研设计工作流：Research → Plan → Align                                       |
| `workflow-troubleshoot`          | 用户或 AI | 问题根因分析工作流：Troubleshoot（分析 → 诊断结论 → 交接给 implement-review） |
| `workflow-implement-review`      | 用户或 AI | 统一实施交付工作流：Implement → Test → Review → Validate → Documentation → Commit |
| `workflow-manage-tasks`          | 用户或 AI | 任务分派工作流：理解梳理 → 派发子代理 → 跟踪推进                              |
| `max-effort`                     | 仅用户    | 最高强度模式：质量 > 速度，SOTA 迭代，重活委托子代理                          |
| `e2e`                            | 仅用户    | 端到端自测模式：交付前 Agent 先行完整自测，仅用户可验项留档                   |
| `delay-validation`               | 仅用户    | 延迟验证模式：对齐闸门挂账，决策台账 + 审计包，事后对账                       |
| `spawn-deep-researcher`          | 用户或 AI | 启动网络调研子代理                                                            |
| `spawn-reviewer`                 | 用户或 AI | 启动代码检视子代理                                                            |
| `cross-check`                    | 用户或 AI | 使用独立子代理复核关键结论                                                    |
| `commit-own-changes`             | 用户或 AI | 多 agent 并发时只提交自己改动的文件/行，不带走别人的修改                      |
| `worktree`                       | 用户或 AI | git worktree 并行开发约定：隔离、命名、清理，与 try / commit-own-changes 分工 |
| `teach-me`                       | 仅用户    | 教授当前项目负责人必须掌握的关键设计、核心知识、权衡与风险信号                |
| `grilling`                       | 用户或 AI | 向用户盘问设计方案                                                            |
| `tidy`                           | 仅用户    | 清理当前会话中的无效修改                                                      |
| `handoff`                        | 仅用户    | 总结当前会话用于交接                                                          |
| `try`                            | 用户或 AI | 修改前先备份便于回滚                                                          |
| `bad-smell`                      | 用户或 AI | 识别代码坏味道，小范围随手优化，大范围记录后回到原任务                        |
| `unstuck`                        | 用户或 AI | 连续修改未达预期时强制退一步重新分析                                          |
| `web-search-best-practice`       | 用户或 AI | 网络搜索的方法论与最佳实践                                                    |
| `code-deep-dive`                 | 仅用户    | 为 vibe coding 项目编写中文深度学习长文（docs/learning/）                     |
| `update-project-instruction`     | 用户或 AI | 创建/更新项目根 AGENTS.md（目标/地图/开发与测试）                             |
| `update-module-instruction`      | 用户或 AI | 创建/更新子模块 AGENTS.md（职责/地图/核心设计/Pitfalls）                      |
| `update-references`              | 用户或 AI | 创建/更新通用规范文档（测试规范/设计规范 etc.）                               |
| `update-validation-requirements` | 用户或 AI | 创建/更新用户验证表，记录核心场景和必须实机验证的场景                         |

### Hooks（钩子）

| 文件                 | 事件           | 说明                                        |
| -------------------- | -------------- | ------------------------------------------- |
| `agents-md-loader`   | `SessionStart` / `PreToolUse` | 让 Claude Code 读取 AGENTS.md：会话启动注入 git root→cwd 链，进入子目录按需注入，压缩后重注入 |
| `long-file-reminder` | `PostToolUse`  | 长文件提醒：超过行数阈值时提示拆分          |

> Hooks 通过 APM 部署：claude 目标合并进 `.claude/settings.json`，脚本 bundle 部署到 `.claude/hooks/rabbit-skills/`。

## 自定义

按需配置各个子代理使用的模型，建议为 reviewer、expert 选择高级模型。

本项目默认没有对 spec 格式和测试规范做任何约束。如果需要更强约束，请在项目级指令中添加。

本项目的提示词都是 self-explanatory 的，你可以根据实际需要任意增改。

## FAQ

### 为什么推荐全局安装？

我们用全局指令设定全局风格，用项目级 AGENTS.md 记录项目指引。项目级安装时两者可能冲突。
若希望项目级安装，可手动更换 03_documentation，update-project-instruction 和 update-module-instruction 中指引文档的文件名，将 AGENTS.md 替换为其他文件名即可。

### 项目指引写在 AGENTS.md 里，能兼容 Claude Code 吗？

能。虽然 CC 不会自动注入 AGENTS.md，但文档规范中明确要求了：「在任一项目/模块中工作前，确保已了解该项目/模块的 AGENTS.md」。AGENTS.md 没有自动注入的情况下，Agent 会在工作前自主阅读，效果等价。

### 计划和实施是否应该在分开的会话中进行？

如果仅通过文档传递计划可能在交接过程产生失真。相反，一个不会产生失真的严格计划已经无限接近于完整的实施了。大多数情况下，计划阶段产生的上下文对于实施阶段同样有用。计划与实施上下文隔离的收益并不大却增加了额外的复杂度和交接的脆弱性。

因此，一般建议在同一会话中进行计划和实施。只有在计划阶段产生的上下文已经过于庞杂的情况下，才推荐在新会话中依靠计划文档继续实施。

另一方面，review，research 和 cross-check 则利用子代理上下文隔离的特性，避免了对错误的路径依赖。（v0.3 曾提供 planner / iterator / bugfixer 三个阶段型主 Agent，v0.4 起移除：它们把「阶段拆分」和「上下文隔离」捆绑在一起，而前者正是我们不推荐的。）

### 什么是闸门的「现结」与「挂账」？

工作流中需要用户确认的节点（计划对齐、诊断对齐、验证门、分发策略审阅）统称**对齐闸门**——与**置信闸门**（95% / 85% / 检视准入，由 Agent 自行满足）相对。对齐闸门默认**现结**：到达时暂停，等用户确认后前进。`/delay-validation` 激活后改为**挂账**：Agent 按最佳判断通过闸门，把决策和理由记入台账，仅用户可验的项目留档，全部工作完成后输出审计包供用户事后对账。

挂账不改变闸门本身——置信闸门（95% / 85% / 检视准入）始终由 Agent 自行满足；不可逆动作（发布、删除）永远不能挂账。
