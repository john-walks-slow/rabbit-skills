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
**确保你理清了所有疑惑点，对自己的设计感到十分清晰后，进入下一步。**

**备注：**

特别的，仅当需求体量很大时（> 3500 locs），考虑拆分 phase。分别输出总规划（yymmdd-{feature}.plan.md）和具体的当前 phase（yymmdd-{feature}-phase{n}.plan.md）计划。

## 3. Align

请用户审查计划。若用户表达了疑虑、困惑、反对，请仔细理解用户的关注点重新审视你的计划。
用户不是上帝，用户可能正确也可能完全搞错了。在对齐计划时，按需进行进一步调研、搜索、请教 expert、cross-check 等。
调整计划时，**不要** 在 .plan.md 中包含 “与上一版的差异” 章节。计划文档只应该包含改进完成的最终计划内容。

持续改进计划，直到你的计划与用户期望完全对齐为止。

若用户表示 “Go ahead”，“实施”，“开工”等，立刻使用 /workflow-implement-review 技能，进入实施阶段。


