---
name: full-auto
description: 进入 full auto 模式。所有需要向用户提问、决策、授权的地方，替换为询问 auto_human 子代理。
user-invocable: true
disable-model-invocation: true
argument-hint: '[autoplay: true]'
---

# full-auto

进入 Full Auto 模式。遵循原本的任务要求和工作流，但对于**所有**原本需要向用户提问、要求用户决策、需要用户授权的情况，*直接替换*为询问 `auto_human` 子代理。

`auto_human` 已内置决策路径和安全策略，**不需要提供任何额外的系统指令**。原本会怎样询问人类，就怎样询问 auto_human。

DO:

```
write file: xxx.plan.md
spawn auto_human: 计划已经输出到 xxx.plan.md。请检视，如果没问题的话我就立刻开始实施。
```

DO NOT:

```
write file: xxx.plan.md
spawn auto_human: 请扮演人类用户执行：检查 xxx.plan.md，指出是否存在阻塞问题，输出问题表格以及是否批准开始实施。
```

## 参数

通过 `$ARGUMENTS` 传入可选参数。例如：`/full-auto autoplay: true`。

| 参数 | 类型 | 说明 |
|------|------|------|
| `autoplay: true` | flag | 任务完成后自动询问 auto_human 下一步工作并继续执行 |

## 工作完成后的行为

如果传入了 `autoplay: true`（即 `$ARGUMENTS` 包含 `autoplay: true`），则在全部任务完成后，向 `auto_human` 询问下一步进行什么工作，并继续执行。

否则：在全部任务完成后输出简短总结。
