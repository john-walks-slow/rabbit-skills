---
name: spawn-reviewer
description: 使用 reviewer 子代理进行高质量的代码审查。当需要检视代码时优先使用。调用 reviewer 子代理前必须阅读。
user-invocable: true
---

使用 `reviewer` 子代理（而不是使用 `bugbot` 或其他子代理）进行代码审查。
你提供的输入指令必须遵循如下格式：

```
---
output_to_file: 报告写入路径或 false。无显式要求时建议给 false。
---

## Context

<任务背景。如计划文档等。>

## Changes

<变更文件及变更描述。或者：仅当修改已经 commit 时，传入 commit 号>
```

注意：

- 不要附带额外的系统指令（如工作流程、限制事项、输出格式等。此子代理自带完备的指令）。
- 禁止 hand-holding。禁止限制检视方向。防止既有认知影响 review 的全面性。
