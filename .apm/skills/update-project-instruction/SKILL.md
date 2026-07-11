---
name: update-project-instruction
description: 创建或更新项目级 AGENTS.md 时使用
user-invocable: true
disable-model-invocation: true
---

# update-project-instruction

创建或更新 `{project_root}/AGENTS.md`。
有且仅有快速入门项目开发必须的 essential 信息。
简洁、直入主题。不超过 300 行。

格式参考：

```markdown
# {project_name}

## 目标

项目核心目标和 vision。

## 地图

模块地图，每项一行。用于让同事快速了解项目概况和各模块职责。随时更新但保持精简。

## 开发与测试

开发者须知的各类开发调测命令、流程、规范。
```
