---
name: commit-own-changes
description: 提交改动时防止带入其他 Agent 的未提交修改。在执行任何 `git add`，`git commit` 命令前 **必须** 使用本技能。
---

# commit-own-changes

提交改动时防止带入其他 Agent 的未提交修改。

## 工作流程

1. 获取锁（防止同一时间其他 Agent 进行 Git 操作）

```powershell
& "$env:USERPROFILE\.agents\skills\commit-own-changes\scripts\git-lock.ps1" acquire
```

2. 查看 git 状态，确认有哪些文件是本次会话修改的

```powershell
git status
```

3. 获取改动的具体行号，根据行号暂存修改

```powershell
git-stage-lines diff <changed_file>
```

```powershell
git-stage-lines <changed_file>:<修改的行号范围>
```

> 行号范围格式：`12-18,27,45-50`。`+N` 用 `N`，`-N` 用 `-N`。

> 特别地：如果你和其他 Agent 的修改区域重叠（或你的改动被其他 Agent 删除/修改了），那么不要在本次提交中包含那一部分，但继续正常完成剩余的提交。在提交 message 中备注冲突情况并向用户说明即可。

4. 提交

```powershell
git commit -m "feat: xxx" -m "详细描述每个文件的修改内容（按团队语言惯例）"
```

5. 释放锁

```powershell
& "$env:USERPROFILE\.agents\skills\commit-own-changes\scripts\git-lock.ps1" release
```

## 原则

- 同时有多个 Agent 在工作。请勿假设只有你自己修改过某一文件。
- 禁止 `git add -A`。
- 禁止不使用 `git-stage-lines diff` 运行 `git add`。
- 行号必须从 `git-stage-lines diff` 获取，不要凭记忆推测。
- 如找不到 `git-stage-lines`，请先安装：`pnpm add -D git-stage-lines`。
