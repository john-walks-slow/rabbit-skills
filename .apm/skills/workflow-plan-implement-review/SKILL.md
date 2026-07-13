---
name: workflow-plan-implement-review
description: 完成需求的调研、设计、开发、检视、交付。
user-invocable: true
disable-model-invocation: true
---

# workflow-plan-implement-review

作为 Project Lead 完成需求的调研、设计、开发、交付。
你的目标是保证开发质量，对最终用户体验和长期开发者体验负责。

遵守以下工作流程：

## 1. Research

确保正确理解用户意图。充分调研对计划与实现有帮助的背景信息和外部信息。
使用 explore 子代理探索代码库。使用 /spawn-deep-researcher 进行深度调研（指定输出文件: /docs/features/{feature}/yymmdd-{topic}.research.md）。
**当你有 95% 把握具备充分、完备的背景信息后才进入下一步。**

## 2. Plan

设计需求、规划方案与架构，并与用户对齐计划。
计划文档输出到 /docs/features/yymmdd-{feature}/yymmdd-{feature}.plan.md。
若你对于自己的选型有所犹豫，或当该工作事关重大时，请额外执行一次 /cross-check。
特别的，仅当需求体量很大时（> 3000 locs），考虑拆分 phase。输出总规划（yymmdd-{feature}.plan.md）和具体的当前 phase（yymmdd-{feature}-phase{n}.plan.md）计划。
**当你对自己的计划感到十分清晰，并且 _得到用户书面同意后_ 才进入下一步。**

## 3. Implement

根据计划实施直到完成计划的全部工作。
当工作量较多时（> 1000 locs），将计划交给 general 子代理实施。包含多个互相独立可并行的单元时，可并行拉起多个子代理。
**当你完成计划的全部内容后才进入下一步。**

## 4. Validation

检查 ide 是否报错，确保项目编译正常。
若项目具有测试规范，按照惯例运行和编写测试。
然后向用户简述本次实现的功能，请用户体验。
**当用户书面确认功能正常后才进入下一步。**

## 5. Review

使用 /spawn-reviewer 检视代码（而不是使用 bugbot 子代理），指定检视报告输出位置为 /docs/features/yymmdd-{feature}/yymmdd-{feature}.review.md。
若检视发现阻塞问题和合理的建议，则进行修改和优化。修改后再次将本次实施的全部代码提交检视。
**直到拥有明确准入结论后才进入下一步。**

## 6. Documentation

将本次需求背景、计划、实施中的重点与值得后续注意的部分简要记录到 /docs/features/yymmdd-{feature}/yymmdd-{feature}.summary.md。
遵循规范按需更新模块级和项目级 AGENTS.md。

## 7. Commit

最后，在征得用户 _书面确认_ 后提交本次修改的文档和文件。遵循项目提交规范。

**备注:**

根据实际情况，你可以从任一阶段开始工作。如：从现有调研开始计划；从现有计划开始执行；对现有代码进行检视。
当用户书面要求时，你可以调整工作流。如：跳过用户 validation 步骤；对计划进行多次 cross-check；并行 spawn 多个 reviewer 等。
