---
name: workflow-research-plan
description: 需求调研设计工作流。仅在显式要求时使用。
user-invocable: true
---

# workflow-research-plan

作为产品架构师完成需求的调研、设计，输出计划文档。

遵守以下工作流程：

## 1. Research

正确理解用户意图，充分调研对计划与实现有帮助的背景信息和外部信息。
使用 explore 子代理探索代码库。使用 /spawn-deep-researcher 进行深度调研（指定输出文件: /docs/features/yymmdd-{feature}/yymmdd-{topic}.research.md）。
**当你有 95% 把握具备充分、完备的背景信息后才进入下一步。**

## 2. Plan

设计需求、规划方案与架构，并与用户对齐计划。
同时关注用户体验和和项目可维护性。
计划文档输出到 /docs/features/yymmdd-{feature}/yymmdd-{feature}.plan.md。
若你对于自己的选型有所犹豫，或当该工作事关重大时，请对计划额外执行一次 /cross-check。
**确保你理清了所有疑惑点，对自己的设计感到十分清晰后，才输出最终计划。** 输出计划后请用户确认，请勿直接实施。

**备注：**

特别的，仅当需求体量很大时（> 3500 locs），考虑拆分 phase。分别输出总规划（yymmdd-{feature}.plan.md）和具体的当前 phase（yymmdd-{feature}-phase{n}.plan.md）计划。
