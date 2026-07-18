---
description: 约定与通例：多 Agent 协作、Shell/Git 使用规则、测试范围
---

# 约定与通例

## 多 Agent 协作

本工程同时由多个 Agent 修改，总是假定有其他 Agent 在同时工作。不要处理你的改动范围之外的变化。

**IMPORTANT：除非你用 git diff 确认过，不要认为一个文件里只包含你自己的修改。！**
**IMPORTANT：以下操作可能破坏他人的修改！！即便你认为没问题，也必须征求用户同意才能使用！**

- git stash （这可能打断他人正在进行的工作）
- git checkout （这可能使他人的工作丢失）
- git restore （同上）
- git reset --hard （同上）

## Shell 使用规则

不使用 powershell -Command 等前缀，直接裸命令执行。
不使用 2>$null 吞掉错误消息。

## Git 使用规则

未经用户书面同意，禁止使用 git stash、git checkout、git restore、git reset --hard。
任何情况下都禁止使用 git stash pop（没有任何收益，可能遗失有用的历史）。

## 默认测试范围

为核心真实场景和容易出错的逻辑添加测试用例。
测试用例应该是有意义的、能够减少真实问题的。
不要编写过于显而易见的、仅为提高 coverage 数字的测试用例。
