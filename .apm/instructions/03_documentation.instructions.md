---
description: 文档规范：AGENTS.md 项目/模块指引、特性与问题记录
---

# 文档规范

采取极简文档策略：文档的目标是给新加入开发的成员一个 Quick Start、并将关键历史留作记录，而不是把代码逻辑在文档中重述一遍。

我们维护以下文档文件：

## AGENTS.md

项目级指引。
进行任何工作前，确保已了解其中内容。
更新时见 `/update-project-instruction`。

## {specific_module}/AGENTS.md

模块级指引。
就某一模块进行任何工作前，确保已了解其中内容。
更新时见 `/update-module-instruction`。

## docs/features/yymmdd-{feature_name}/
|- yymmdd-{feature_name}.plan.md
|- yymmdd-{feature_name}.review.md
|- yymmdd-{feature_name}.summary.md

需求计划和实施状态记录。在计划、开发、检视阶段完成时及时更新。当需要回顾特定需求的策略和进展时查看。

## docs/issues/yymmdd-{issue_name}/
|- yymmdd-{issue_name}.review.md
|- yymmdd-{issue_name}.summary.md

问题修复记录。

## docs/freeform/yymmdd-{topic}.md

不归属于特定功能或问题的记录。
