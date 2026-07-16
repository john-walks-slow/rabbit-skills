---
name: update-project-instruction
description: 项目级 AGENTS.md 更新规范。当新建项目；新建或重构模块；更新必须了解的工作流程、调测命令、开发规范时使用。
user-invocable: true
---

# update-project-instruction

创建或更新 `{project_root}/AGENTS.md`。
仅包括快速入门项目开发必须的信息。
极简、直入主题。不超过 300 行。
特定领域的详细规范请更新 `{project_root}/docs/references/{topic}.md` 并在 本文件 中引用。

格式参考：

```markdown
# {project_name} AGENTS.md

## 目标

项目核心目标和 vision。

## 地图

模块地图，每项一行。用于让同事快速了解项目概况和各模块职责。随时更新但保持精简。

## 开发与调试

必须了解的编译、调测命令与流程。只记录最核心的内容。

## 规范

项目特定的开发者规范和须知。禁止重复全局指令已经包含的通用规范。若无则省略。
```
