# rabbit-skills

轻量、松弛、有效的 Coding Agent 配置套件。适合中等规模的 AI 原生项目开发。

## 0.20.0 更新说明

从 0.20.0 开始，移除了所有 workflow 技能，并将更多的 Skill 调整为 `disable-model-invocation`。

工作流的概念对于目前的模型已经没有收益了，三条工作流已经被简化为输出风格中的三句提示词。

在模型自主判断的基础上，你可以通过“修饰”的方式来要求需要的额外步骤。

例如：涉及核心模块修改时，queue：`/spawn-reviewer`

交付前需要端到端验证时，queue：`/spawn-e2e-tester`

希望计划前深度调研时，要求：`/spawn-deep-researcher`

希望使用上述全部能力最大深度工作时，要求：`/max-effort`

目前，本套件的主要意义在于提供：

一套写得不错的基础提示词；一套文档格式约定；一些能够强化工作深度的子代理和修饰器技能；一些通用工具技能。

而不再提供工作流。

## 安装

### A. 预构件安装

[![Release](https://img.shields.io/github/v/release/john-walks-slow/rabbit-skills?label=release)](https://github.com/john-walks-slow/rabbit-skills/releases/latest)

下载最新 release，将内容解压到对应工具配置目录即可。

### B. 通过 APM 安装

确保已安装 [APM CLI](https://microsoft.github.io/apm/getting-started/installation/)。

全局安装到所有支持用户级目录的工具（13 个 runtime）：

```bash
apm install -g john-walks-slow/rabbit-skills
```

> `agents`、`copilot-app`、`copilot-cowork`、`grok-cloud`、`intellij`、`openclaw` 没有用户级配置目录（部分还需 APM 的实验性开关），无法全局安装（APM 会报 `Unknown target`）。这些工具请在项目内安装并用 `-t` 指定：
>
> ```bash
> apm install -t intellij john-walks-slow/rabbit-skills
> ```

如果你的工具原生不支持 Instructions / Rules（apm 提示：`Run 'apm compile -g' to update root context files for …`），需额外将 Instructions 编译为全局指令：

```bash
apm compile -g
```

> 注：compile 不会覆盖你原先手写的指令（AGENTS.md 等）。如果希望覆盖，请在备份后删除原有指令文件，再次执行 compile -g。

## 内容物

### Instructions（系统指令）

| 文件               | 说明     |
| ------------------ | -------- |
| `00_output_style`  | 输出风格 |
| `01_coding_style`  | 编码规范 |
| `03_documentation` | 文档规范 |
| `09_custom`        | 约定与通例（协作 / Shell / Git / 子代理 / 测试范围 / 安全） |

### Agents（代理和子代理）

| 名称              | 类型     | 说明                                                                         |
| ----------------- | -------- | ---------------------------------------------------------------------------- |
| `deep-researcher` | subagent | 网络调研                                                                     |
| `reviewer`        | subagent | 代码检视                                                                     |
| `e2e-tester`      | subagent | 端到端测试                                                                   |
| `expert`          | subagent | 通用困难任务                                                                 |

### Skills & Commands（技能与命令）

| 技能                             | 激活方式  | 说明                                                                          |
| -------------------------------- | --------- | ----------------------------------------------------------------------------- |
| `spawn-deep-researcher`          | 用户或 AI | 启动网络调研子代理                                                            |
| `spawn-reviewer`                 | 用户或 AI | 启动代码检视子代理                                                            |
| `spawn-e2e-tester`               | 用户或 AI | 启动端到端测试子代理                                                          |
| `commit-own-changes`             | 用户或 AI | 多 agent 并发时只提交自己改动的文件/行，不带走别人的修改                      |
| `worktree-dev`                   | 用户或 AI | Git Worktree 隔离开发；worktree 内端口动态申请                               |
| `code-deep-dive`                | 仅用户    | 为项目编写中文深度学习长文，碎片时间补齐代码知识                              |
| `grilling`                       | 仅用户    | 向用户盘问设计方案                                                            |
| `similar-idea`                   | 用户或 AI | 找相似项目/既有产品，了解市场现状，防止重复造轮子                             |
| `cross-check`                    | 仅用户    | 使用独立子代理复核关键结论                                                    |
| `tidy`                           | 仅用户    | 清理当前会话中的无效修改                                                      |
| `handoff`                        | 仅用户    | 总结当前会话用于交接                                                          |
| `bad-smell`                      | 用户或 AI | 识别代码坏味道，小范围随手优化，大范围记录后回到原任务                        |
| `max-effort`                     | 仅用户    | 最大交付质量：最少消耗用户精力，极致质量 + 端到端测试交付                      |
| `update-project-instruction`     | 用户或 AI | 创建/更新项目根 AGENTS.md（目标/地图/开发与测试）                             |
| `update-module-instruction`      | 用户或 AI | 创建/更新子模块 AGENTS.md（职责/地图/核心设计/Pitfalls）                      |
| `update-skill`                   | 用户或 AI | 编写新技能、编辑已有技能，或询问 SKILL.md 结构                                |
| `update-validation-requirements` | 用户或 AI | 创建/更新用户验证表，记录核心场景和必须实机验证的场景                         |

## 自定义

按需配置各个代理使用的模型，建议为 reviewer，expert 选择高级模型。

本项目默认没有对 spec 格式和测试规范做强约束。如果需要更强约束，请在项目级指令中添加。

本项目的提示词请根据实际需要任意增改。

## FAQ

### 计划和实施是否应该在分开的会话中进行？

个人不建议。计划阶段产生的上下文对于实施阶段同样有用，如果仅通过文档传递计划可能在交接过程产生失真。相反，一个不会产生失真的严格计划已经无限接近于完整的实施了。计划与实施上下文隔离的收益并不大却增加了额外的复杂度和交接的脆弱性。

因此，一般建议在同一会话中进行计划和实施。只有在计划阶段产生的上下文已经过于庞杂的情况下，才推荐在新会话中依靠计划文档继续实施。

### DeepSeek Harness 是否能使用？

DSH 默认不支持子代理 profile，导致依赖特定子代理的技能可能无法正常使用。
为 DSH 安装 @aiwayds/dsh-subagent-registry 插件后可支持 Claude 风格的子代理配置。
然后，下载 claude 版本的构建产物，将 agents 放入 ~/.dsh 目录即可。

## 友链

[linux.do](linux.do)
