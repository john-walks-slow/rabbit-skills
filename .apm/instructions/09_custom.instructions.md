---
description: 约定与通例：多 Agent 协作、Shell/Git 使用规则、测试范围
---

# 约定与通例

## 多 Agent 协作

本工程同时由多个 Agent 修改，总是假定有其他 Agent 或人类在同时工作。不要处理你的改动范围之外的变化。

**IMPORTANT：以下操作可能破坏他人的修改！！使用前必须获得用户的书面同意！**

- git stash （可能打断他人正在进行的工作。如果一定要使用，必须先显式征求用户的书面同意！）
- git checkout （这可能使他人的工作丢失。如果一定要使用，必须先显式征求用户的书面同意！）
- git restore （同上）
- git reset --hard （同上）

## Shell 使用规则

执行任何会修改文件内容（例如替换 token）的批处理脚本/命令前，**必须** 先 dry run。
如果在运行必要命令时权限遭到拒绝，可告知用户需要执行的命令，请他手动执行。

## 版本管理规则

- 新建项目时，总是使用 Git 进行版本管理
- 提交消息默认模板：

```
# head: <type>(<scope>): <subject>
# - type: feat, fix, docs, style, refactor, test, chore
# - scope: can be empty (eg. if the change is a global or difficult to assign to a single component)
# - subject: start with verb (such as 'change'), 50-character line
#
# body: 72-character wrapped. This should answer:
# * Why was this change necessary?
# * How does it address the problem?
# * Are there any side effects?
#
# footer: 
# - Include a link to the ticket, if any.
# - BREAKING CHANGE
#
```

## 子代理使用规则

- 发挥、信任子代理的自主性。明确说明任务背景、你的需求、产物要求，无需微管理子代理的具体行事方式。更少的硬约束常常能起到更好的效果。
- 当输入或输出信息超过 600 字时，必须以文件引用的形式传递。

正例：将计划文件链接提供给子代理
反例：向子代理复述计划全文

正例：要求子代理将报告以文件形式输出到指定路径，并仅回复输出文件的链接
反例：不做要求，子代理直接回复2000字的报告文本

## 默认测试范围

为核心真实场景和容易出错的逻辑添加测试用例。
测试用例应该是有意义的、能够减少真实问题的。
不要编写过于显而易见的、仅为提高 coverage 数字的测试用例。

## 安全

- 禁止在由 Git 跟踪的项目代码、测试或文档中包含硬编码的本机路径和敏感信息。（未跟踪的本地Skill、临时测试等不在此限）
