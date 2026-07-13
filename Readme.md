# rabbit-skills

轻量、有效的 Coding Agent 配置套件。适合中等规模的 AI 原生项目开发。

## 原则

- 简洁清晰、零学习成本。相对松弛的约束，不为模型捆手捆脚。
- 通用需求开发工作流。调研设计：Research → Plan。开发交付：Implement → Validation → Review → Documentation → Commit。
- 通用 Bugfix 工作流：先定位再修改避免越改越错。Troubleshoot → Fix → Retest → Review → Documentation → Commit。
- 基于子代理的调研、检视阶段，显著减少幻觉并提高交付质量。
- 日常实用 Skill：`commit-own-changes` 以行为粒度提交修改、`grilling` 盘问计划、`cross-check` 审视既有结论、`handoff` 会话交接、`try` 修改前备份。
- 极简的文档规范，留存开发状态的同时避免历史文档-代码双向同步问题。
- 基于 [APM (Agent Package Manager)](https://microsoft.github.io/apm/) 规范，兼容主流 Agent。

## 安装

### A. 预构件安装

[![Release](https://img.shields.io/github/v/release/john-walks-slow/rabbit-skills?label=release)](https://github.com/john-walks-slow/rabbit-skills/releases/latest)

下载最新 release，将内容解压到对应工具配置目录即可。

### B. 通过 APM 安装

确保已安装 [APM CLI](https://microsoft.github.io/apm/getting-started/installation/)。

全局安装到所有支持的工具：

```bash
apm install -g john-walks-slow/rabbit-skills
apm compile -g
```

> 注：APM 不会覆盖你原先手写的指令（AGENTS.md 等）。
> 如果希望覆盖，请在备份后删除原有指令，再次执行 compile -g。

## 使用

### 方法 A. 通过调用 Workflow Skill（Skill-Based）

```
/workflow-research-plan 调研 Agent 记忆的 sota 方案，给我的 Agent 加上记忆功能。
```

认可计划后调用：

```
/workflow-implement-review 实施。
```

修复 Bug 时调用 `/workflow-troubleshoot-fix-review`。

### 方法 B. 通过切换 Agent（Agent-Based）

如果你的 Agent 工具支持随时切换主 Agent（如 opencode 和 copilot），则更推荐使用此方式。提示词引用对应 Skill 的内容，优点是可以为不同阶段设置不同模型。

调研和设计新方案时切换到 `plan`。
实施时切换到 `iterate`。
修复 bug 时切换到 `bugfix`。

## 内容物

### Instructions（系统指令）

| 文件               | 说明     |
| ------------------ | -------- |
| `00_output_style`  | 输出风格 |
| `01_coding_style`  | 编码规范 |
| `03_documentation` | 文档规范 |
| `09_custom`        | 其他惯例 |

### Agents（代理和子代理）

| 名称              | 说明                            |
| ----------------- | ------------------------------- |
| `deep-researcher` | 网络调研                        |
| `reviewer`        | 代码检视                        |
| `expert`          | 通用困难任务                    |
| `auto-human`      | 自动决策（用于 full-auto 模式） |
| `plan` (Agent-Based) | 调研和设计新方案，引用 /workflow-research-plan |
| `iterate` (Agent-Based) | 实施并交付，引用 /workflow-implement-review |
| `bugfix` (Agent-Based) | 定位和修复 Bug，引用 /workflow-troubleshoot-fix-review |
| `leader` (Agent-Based) | 自主迭代，委托 plan/iterate/bugfix 子代理 |

### Skills & Commands（技能与命令）

| 技能                               | 激活方式  | 说明                                                                         |
| ---------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `workflow-research-plan`           | 用户或 AI | 调研设计工作流：Research → Plan                                                |
| `workflow-implement-review`        | 用户或 AI | 开发交付工作流：Implement → Validation → Review → Documentation → Commit       |
| `workflow-troubleshoot-fix-review` | 用户或 AI | Bugfix 工作流：Troubleshoot → Fix → Retest → Review → Documentation → Commit |
| `handoff`                          | 仅用户    | 总结当前会话用于交接                                                         |
| `spawn-deep-researcher`            | 用户或 AI | 启动网络调研子代理                                                           |
| `spawn-reviewer`                   | 用户或 AI | 启动代码检视子代理                                                           |
| `grilling`                         | 用户或 AI | 向用户盘问设计方案                                                           |
| `try`                              | 用户或 AI | 修改前先备份便于回滚                                                         |
| `cross-check`                      | 用户或 AI | 使用独立子代理复核关键结论                                                   |
| `commit-own-changes`               | 用户或 AI | 多 agent 并发时只提交自己改动的文件/行，不带走别人的修改                     |
| `full-auto`                        | 仅用户    | 全自动模式：所有需要用户决策的地方自动由 auto-human 代理                     |
| `update-project-instruction`       | 用户或 AI | 创建/更新项目根 AGENTS.md（目标/地图/开发与测试）                            |
| `update-module-instruction`        | 用户或 AI | 创建/更新子模块 AGENTS.md（职责/地图/核心设计/Pitfalls）                     |

### Hooks（钩子）

| 文件                 | 说明                               |
| -------------------- | ---------------------------------- |
| `long-file-reminder` | 长文件提醒：超过行数阈值时提示拆分 |

## 自定义

按需配置各个子代理使用的模型，建议你为 expert 子代理选择高级模型。
本项目的提示词都是 self-explanatory 的。你可以任意编辑和选用。

## FAQ

### 为什么推荐全局安装？

我们用全局指令设定全局风格，用项目级 AGENTS.md 记录项目指引。项目级安装时两者可能冲突。
若希望项目级安装，可手动更换 03_documentation，update-project-instruction 和 update-module-instruction 中指引文档的文件名，将 AGENTS.md 替换为其他文件名即可。

### 项目指引写在 AGENTS.md 里，能兼容 Claude Code 吗？

能。虽然 CC 不会自动注入 AGENTS.md，但文档规范中明确要求了：「在任一项目/模块中工作前，确保已了解该项目/模块的 AGENTS.md」。AGENTS.md 没有自动注入的情况下，Agent 会在工作前自主阅读，效果等价。

### 计划和实施是否应该在分开的会话中进行？

如果仅通过文档传递计划可能在交接过程产生失真。相反，一个不会产生失真的严格计划已经无限接近于完整的实施了。大多数情况下，计划阶段产生的上下文对于实施阶段同样有用。计划与实施上下文隔离的收益并不大却增加了额外的复杂度和交接的脆弱性。

因此，一般建议在同一会话中进行计划和实施。只有在计划阶段产生的上下文已经过于庞杂的情况下，才推荐在新会话中依靠计划文档继续实施。

另一方面，review，research 和 cross-check 则利用子代理上下文隔离的特性，避免了对错误的路径依赖。
