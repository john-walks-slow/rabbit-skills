---
description: 文档规范：AGENTS.md 项目/模块指引、特性与问题记录
---

# 文档规范

采取极简文档策略：文档的目标是给新加入开发的成员一个 Quick Start、并将关键历史留作记录，而不是把代码逻辑在文档中重述一遍。

当文档内容与实际代码不一致，请以实际代码为准，主动更新文档。

更新文档时，优先对相关文段进行改写、重述、扩展，而不是补丁式堆砌。新增内容必须融入文档的内生逻辑，从而防止文档变得臃肿、混乱。当你觉得文档越来越不可读，难以获取信息时，就是时候主动进行精简和重构了！

我们维护以下文档文件：

## AGENTS.md

项目级指引。
**进行任何工作前，必须确保已了解其中内容。**
更新规则见 `/update-project-instruction`。

## {module_path...}/AGENTS.md

模块/子模块级指引。
**就某一模块进行任何工作前，必须确保已了解其中内容。**
更新规则见 `/update-module-instruction`。

## docs/features/yymmdd-{feature_name}/

|- yymmdd-{topic}.research.md (optional)
|- yymmdd-{feature_name}.plan.md
|- yymmdd-{feature_name}.review.md (optional)
|- yymmdd-{feature_name}.summary.md
|- yymmdd-{feature_name}.validation.md (optional)
|- e2e/yymmdd-{topic}/yymmdd-{topic}-e2e-report.md (optional)

需求计划和实施状态记录。根据工作流中的要求，在计划、开发、验证、检视阶段完成时及时更新。当需要回顾特定需求的策略和进展时查看。

## docs/issues/yymmdd-{issue_name}/

|- yymmdd-{issue_name}.troubleshoot.md
|- yymmdd-{issue_name}.review.md (optional)
|- yymmdd-{issue_name}.summary.md
|- yymmdd-{issue_name}.validation.md (optional)
|- e2e/yymmdd-{topic}/yymmdd-{topic}-e2e-report.md (optional)

问题修复记录。根据工作流中的要求，在问题复现、分析、修复、验证、检视阶段完成时及时更新。当需要回顾特定问题的分析和解决进展时查看。

## docs/references/yymmdd-{topic}.md

不归属于特定模块和需求的领域级规范（例：设计规范、测试规范），可以被模块和项目级指引引用。
更新规则见 `/update-references`。

## docs/freeform/yymmdd-{topic}.md

不归属于特定模块和需求的其他记录。

## README.md

面向用户的说明入口。发布前需确保 README 已覆盖开始使用所需的全部配置说明。
