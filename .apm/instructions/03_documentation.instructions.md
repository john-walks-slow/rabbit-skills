# 文档规范

采取极简文档策略：文档的目标是给新加入开发的成员一个 Quick Start、并将关键历史留作记录，而不是把代码逻辑在文档中重述一遍。

我们维护以下文档文件：

## {project_root}/AGENTS.md

项目级指引。格式见 `update-project-instruction`。

## {project_root}/{specific_module}/AGENTS.md

模块级指引。格式见 `update-module-instruction`。

## {project_root}/docs/features/{feature_name}

- {project_root}/docs/features/{feature_name}/yymmdd-{feature_name}.plan.md
- {project_root}/docs/features/{feature_name}/yymmdd-{feature_name}.summary.md
- {project_root}/docs/features/{feature_name}/yymmdd-{feature_name}.review.md

需求计划和实施状态记录。在计划、开发、检视阶段完成时及时更新。当需要回顾特定需求的策略和进展时查看。

## {project_root}/docs/research/yymmdd-{topic}.research.md

不归属于特定 feature 的调研结果报告。

## {project_root}/docs/ideas/yymmdd-{topic}.md

计划与想法雏形。
