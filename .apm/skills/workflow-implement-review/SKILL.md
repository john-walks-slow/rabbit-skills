---
name: workflow-implement-review
description: 实施交付工作流。无论是需求开发还是问题修复，都必须遵守此流程完成实施、验证、检视与提交。
user-invocable: true
---

# workflow-implement-review

作为主工程师完成修改的实施与交付。
保证开发质量，对最终用户体验和长期开发者体验负责。

遵守以下工作流程：

## 1. Implement

仔细阅读提供的计划或问题诊断，实施代码修改。遵循最佳编码实践————代码的可读、可维护 与功能实现同样重要。

**当你完成全部计划中的全部实施内容后才进入下一步。**

## 2. Validate

检查 IDE 是否报错，确保项目编译正常。
若项目具有测试规范，按照惯例运行和编写测试。

使用 /update-validation-requirements 创建或更新用户验证要求文档。只记录最重要的核心场景，以及自动化测试无法可靠覆盖、必须实机验证的场景；没有符合条件的验证项时直接说明无需额外用户验证。

向用户简述本次实现，请用户按照验证文档完成验证并填写实际结果、状态和备注/证据。

**当用户书面确认功能正常后才进入下一步。**

> 若实际现象与你的预期明显不符，请撤销无效的、可疑的修改，使用 /workflow-troubleshoot 重新定位问题。
> 如果你连续多次修改都未达预期，意味着当前思路不可靠或缺乏关键线索，继续试错只会引入更多不确定性。请清空既有思路从零梳理，不要在错误的路径上反复打转。

## 3. Review

使用 /spawn-reviewer 检视代码（而不是使用 bugbot 子代理），指定检视报告输出位置：

- 需求开发：`/docs/features/yymmdd-{feature_name}/yymmdd-{feature_name}.review.md`
- 问题修复：`/docs/issues/yymmdd-{issue_name}/yymmdd-{issue_name}.review.md`

若检视发现阻塞问题和合理的建议，则进行修改和优化。修改后**再次**将本次实施的全部代码提交检视。
**直到拥有明确准入结论后才进入下一步。**

## 4. Documentation

记录本次工作的背景与结果：

- 需求开发：`/docs/features/yymmdd-{feature_name}/yymmdd-{feature_name}.summary.md`
- 问题修复：`/docs/issues/yymmdd-{issue_name}/yymmdd-{issue_name}.summary.md`

遵循规范按需更新模块级和项目级 AGENTS.md。当且仅当有对后续开发有明确收益的通用经验时，记录到模块 pitfalls 部分。

## 5. Commit

最后，在征得用户 _书面确认_ 后提交本次修改的文档和文件。遵循项目提交规范。
注意：Commit 步骤需要单独的用户批准，此前步骤的授权不能延伸到本步骤。

**备注:**

当用户书面要求时，你可以调整工作流。如：跳过用户 validation 步骤；并行 spawn 多个 reviewer 等。
