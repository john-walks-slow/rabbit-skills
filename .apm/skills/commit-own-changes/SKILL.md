---
name: commit-own-changes
description: >-
  提交改动时防止带入其他无关的未提交修改。事关安全，在执行任何 `git add` / `git commit`
  前 **必须** 使用本技能。一律通过 own.mjs（agent-ownership hooks）提交。
---

# commit-own-changes

提交改动时防止带入其他无关的未提交修改。**一律** 走 own.mjs，禁止手搓 stage-lines / `git add -A`。

CLI（本 skill 自带脚本，路径相对 skill 目录）：

```bash
node {skill_dir}/scripts/bin/own.mjs
```

> sessionStart hook 会注入 **绝对路径** 的 commit 命令；优先用 hook 注入的那条。
> 若无注入，用上面的 `{skill_dir}` 路径（APM 安装后 skill 在 `.agents/skills/commit-own-changes/` 或用户目录同等位置）。

## 流程

1. 检视通过后，只提交自己的行：

```bash
node {skill_dir}/scripts/bin/own.mjs status
node {skill_dir}/scripts/bin/own.mjs stage
node {skill_dir}/scripts/bin/own.mjs commit -m "…"
```

2. auto owner 报 ambiguous（exit 2 / 多 owner）：

```bash
node {skill_dir}/scripts/bin/own.mjs owners
node {skill_dir}/scripts/bin/own.mjs commit --owner <conversation_id> -m "…"
```

3. 父 Agent 协调多个子 Agent 的提交：

```bash
node {skill_dir}/scripts/bin/own.mjs plan
node {skill_dir}/scripts/bin/own.mjs commit-each --execute -m "chore(own): commit for {owner}"
```

完整说明见 `{skill_dir}/scripts/README.md`。

## 原则

- 同时有多个 Agent 在工作。请勿假设只有你自己修改过某一文件。
- 禁止 `git add -A`。
- 禁止手搓 `git-stage-lines`；own.mjs 已负责锁与行级 stage。
- own 错误（锁超时、ambiguous、message 缺失、0 owners 等）不得绕过：修复后重试，或中止并向用户报告。
