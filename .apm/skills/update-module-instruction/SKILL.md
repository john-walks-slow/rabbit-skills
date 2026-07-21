---
name: update-module-instruction
description: （子）模块级 AGENTS.md 更新规范。当新建模块；新需求开发结束；模块内容重构结束；记录对后续开发有明确收益的经验时使用。
user-invocable: true
---

# update-module-instruction

创建或更新 `{project_root}/{specific_module}/AGENTS.md`。
仅包括快速熟悉模块开发必须的信息。
简洁、直入主题。不超过 300 行。

格式参考：

```markdown
# {module_name} AGENTS.md

## 职责

模块核心职责。

## 地图

最重要的目录、文件及其职责，每项一行。随时更新但保持精简。请勿每次新增文件都加进来。只列同事上手时必须知道的。

## 核心设计

同事必须了解的架构决策、设计约束、核心概念。请勿事无巨细复述代码逻辑。

## Pitfalls

常见坑和经验。只有反复遇到且通用的坑才记在这。
```
