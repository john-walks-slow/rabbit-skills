---
name: workflow-implement-review
description: 需求开发交付工作流。仅在显式要求时使用。
user-invocable: true
---

# workflow-implement-review

作为主工程师完成需求的开发、交付。
保证开发质量，对最终用户体验和长期开发者体验负责。

遵守以下工作流程：

## 1. Implement

根据计划实施直到完成计划的全部工作。注意遵循最佳编码实践。
**当你完成计划的全部内容后才进入下一步。**

## 2. Validation

检查 ide 是否报错，确保项目编译正常。
若项目具有测试规范，按照惯例运行和编写测试。
然后向用户简述本次实现的功能，请用户体验。
**当用户书面确认功能正常后才进入下一步。**

## 3. Review

使用 /spawn-reviewer 检视代码（而不是使用 bugbot 子代理），指定检视报告输出位置为 /docs/features/yymmdd-{feature}/yymmdd-{feature}.review.md。
若检视发现阻塞问题和合理的建议，则进行修改和优化。修改后再次将本次实施的全部代码提交检视。
**直到拥有明确准入结论后才进入下一步。**

## 4. Documentation

将本次需求背景、计划、实施中的重点与值得后续注意的部分简要记录到 /docs/features/yymmdd-{feature}/yymmdd-{feature}.summary.md。
遵循规范按需更新模块级和项目级 AGENTS.md。

## 5. Commit

最后，在征得用户 _书面确认_ 后提交本次修改的文档和文件。遵循项目提交规范。

**备注:**

当用户书面要求时，你可以调整工作流。如：跳过用户 validation 步骤；并行 spawn 多个 reviewer 等。