---
name: spawn-e2e-tester
description: 派发端到端测试子代理。拉起 e2e-tester 子代理前必须阅读。
user-invocable: true
---

使用端到端测试子代理执行 E2E 测试。你提供的输入指令必须遵循如下格式：

```
---
output_to_file: 报告写入路径。默认 docs/features|issues/yymmdd-x/yymmdd-x.e2e.md
---

## Context

<任务背景：被测功能/修复、相关计划与变更摘要、可用的测试环境与凭据>

## Test Items

<测试项清单：每项含场景描述与预期结果>
```

子代理须按以下格式产出报告并写入 `output_to_file`：

```markdown
# {feature/issue} 端到端测试报告

## 测试环境
- 环境/前置：<设备、浏览器、账号、数据等；无则写「无」>

## 测试项

| # | 测试步骤 | 预期 | 实际 | 状态 | 证据 |
|---|----------|------|------|------|------|
| 1 | <可重复的步骤> | <可观察的结果> | <实际> | 通过/不通过/受阻 | <截图/日志路径> |

## 结论
- 通过：N · 不通过：N · 受阻：N
- 总体：<通过 / 不通过>

## 待跟进
<不通过/受阻项的后续>
```

输出位置：需求 `docs/features/yymmdd-{feature}/yymmdd-{feature}.e2e.md`；问题 `docs/issues/yymmdd-{issue}/yymmdd-{issue}.e2e.md`。默认随对应 feature/issue 目录；`output_to_file` 可覆盖。

注意：

- 不要附带额外的系统指令（如工作流程、限制事项等）。子代理自行决定测试方式与工具。
- 禁止 hand-holding。不要限定具体测试步骤、不要预设具体工具——除非项目级文档有明确指定，此时在 Context 说明即可。
- 若 Test Items 未由用户明确给出，由你（主 Agent）根据需求/计划自行梳理核心场景后填入。
- 派发时在 Context 传足量信息：被测对象、变更摘要、可用的测试环境与凭据、项目级测试规范引用。
