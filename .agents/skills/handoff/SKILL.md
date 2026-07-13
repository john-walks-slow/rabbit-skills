---
name: handoff
description: 编写交接文档，将工作上下文传递给另一个 agent、同事、检视者或 oncall。可选参数：目标受众或方向（例如 "to reviewer"、"给 QA"、"for oncall"）。
argument-hint: '[可选：目标受众 / 方向，如 "to reviewer"、"给 oncall"]'
user-invocable: true
disable-model-invocation: true
---

# handoff

编写一份简洁的交接文档，总结本次会话的工作（~300 行内，使用用户的语言）。让接收者无需翻阅对话即可继续工作。

## 输入

- 目标受众 / 方向 （可选）

## 输出

- 文件路径：`{project_root}/docs/handoffs/yymmdd-{topic}.handoff.md`（目录不存在则创建）
