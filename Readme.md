# rabbit-skills

轻量、有效的 Coding Agent 配置套件。适合中等规模的 AI 原生项目开发。

## 原则

- 简洁清晰、零学习成本。相对松弛的约束，不为模型捆手捆脚。
- 通用需求开发工作流：在一次会话中完成计划到交付。Research → Plan → Implement → Review → Documentation → Commit。
- 通用 Bugfix 工作流：先定位再修改避免越改越错。Troubleshoot → Fix → Retest → Review → Documentation → Commit。
- 基于子代理的调研、检视，显著减少幻觉并提高交付质量。
- 日常实用 Skill：`grilling` 盘问计划、`cross-check` 审视既有结论、`handoff` 会话交接、`try` 修改前备份。
- 极简的文档规范，留存开发状态的同时避免历史文档-代码双向同步问题。
- 基于 [APM (Agent Package Manager)](https://microsoft.github.io/apm/) 规范，适配主流 Agent CLI。

## 安装

### 前置条件

安装 [APM CLI](https://microsoft.github.io/apm/getting-started/installation/)：

```powershell
# Windows
irm https://aka.ms/apm-windows | iex

# macOS / Linux
curl -sSL https://aka.ms/apm-unix | sh
```

### 全局安装

```bash
apm install -g john-walks-slow/rabbit-skills
```

对不支持 Instructions 的工具，还需编译全局指令（运行也没坏处，不清楚是否需要的话就运行）：

```bash
apm compile -g
```

> **Cursor 用户注意**：Cursor 不支持读取 `~/.cursor/AGENTS.md`。请手动将 `~/.cursor/AGENTS.md` 的内容填入 _Cursor Settings → Rules → User_。
> **Claude 用户注意**：当前使用 AGENTS.md 作为项目、模块级指引文件。在 CC 中无法自动注入，可能影响效果。

### 验证安装

```bash
apm audit
```

## 使用

开发新功能时使用 `/workflow-plan-implement-review` 工作流；
修复 Bug 时使用 `/workflow-troubleshoot-fix-review` 工作流。

如：
```
/workflow-plan-implement-review 调研 Agent 记忆的 sota 方案，给我的 Agent 加上记忆功能。
```

## 内容物

### Instructions（系统指令）

| 文件               | 说明     |
| ------------------ | -------- |
| `00_output_style`  | 输出风格 |
| `01_coding_style`  | 编码规范 |
| `03_documentation` | 文档规范 |
| `09_custom`        | 其他惯例 |

### Agents（子代理）

| 名称              | 说明         |
| ----------------- | ------------ |
| `deep-researcher` | 网络调研     |
| `reviewer`        | 代码检视     |
| `expert`          | 通用困难任务 |

### Skills & Commands（技能与命令）

| 技能                             | 激活方式  | 说明                                                                      |
| -------------------------------- | --------- | ------------------------------------------------------------------------- |
| `workflow-plan-implement-review` | 仅用户    | 核心工作流：Research → Plan → Implement → Review → Documentation → Commit |
| `workflow-troubleshoot-fix-review` | 仅用户  | Bugfix 工作流：Troubleshoot → Fix → Retest → Review → Documentation → Commit |
| `handoff`                        | 仅用户    | 总结当前会话用于交接                                                      |
| `spawn-deep-researcher`          | 用户或 AI | 启动网络调研子代理                                                        |
| `spawn-reviewer`                 | 用户或 AI | 启动代码检视子代理                                                        |
| `grilling`                       | 用户或 AI | 向用户盘问设计方案                                                        |
| `try`                            | 用户或 AI | 修改前先备份便于回滚                                                      |
| `cross-check`                    | 用户或 AI | 使用独立子代理复核关键结论                                                |
| `update-project-instruction`     | 用户或 AI | 创建/更新项目根 AGENTS.md（目标/地图/开发与测试）                         |
| `update-module-instruction`      | 用户或 AI | 创建/更新子模块 AGENTS.md（职责/地图/核心设计/Pitfalls）                  |

### Hooks（钩子）

| 文件                 | 说明                               |
| -------------------- | ---------------------------------- |
| `long-file-reminder` | 长文件提醒：超过行数阈值时提示拆分 |
