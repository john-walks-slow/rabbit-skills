---
name: workflow-research-plan
description: 需求调研设计工作流。进行中等以上规模需求开发、架构设计和重构前必须遵守此流程制定计划。
user-invocable: true
---

# workflow-research-plan

作为产品架构师完成调研、设计，输出计划文档。

遵守以下工作流程：

## 1. Research

正确理解用户意图，充分调研对体验设计和架构选型有帮助的背景信息和外部资料。
使用 explore 子代理探索代码库。若适用，使用 /spawn-deep-researcher 进行网络调研（指定输出文件: /docs/features/yymmdd-{feature_name}/yymmdd-{topic}.research.md）。

**当你有 95% 把握掌握了充分、完备的背景信息和网络资料后才进入下一步。**

## 2. Plan

设计用户体验，规划方案与架构。
以最高的优先级关注使用体验和项目可维护性。
计划文档输出到 /docs/features/yymmdd-{feature_name}/yymmdd-{feature_name}.plan.md。
若你对于自己的选型有所犹豫，或当该工作事关重大时，请对计划额外执行一次 /cross-check。

**确保你理清了所有疑惑点，对自己的设计感到十分清晰后，进入下一步。**

> 特别的，仅当需求体量很大时（> 3500 locs），可以考虑拆分 phase，分别输出总规划（yymmdd-{feature_name}.plan.md）和具体的当前 phase（yymmdd-{feature_name}-phase{n}.plan.md）计划。

## 3. Align

请用户检查计划。若用户表达了疑虑、困惑、反对，请仔细理解用户的关注点，重新审视你的计划。
用户不是上帝，用户可能正确也可能搞错。保持独立判断，按需进行进一步调研、搜索、咨询 `expert`、cross-check 等。
调整计划时，**不要** 在 .plan.md 中包含 “与上一版的差异” 章节。计划文档只应该包含改进完成的最终计划内容。

持续改进计划，直到你的计划与用户期望完全对齐为止。

## Next Step

若用户表示 “Go ahead”，“实施”，“开工”等，立刻使用 /workflow-implement-review 技能，基于当前计划进入实施阶段。
