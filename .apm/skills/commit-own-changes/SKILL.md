---
name: commit-own-changes
description: 提交改动时防止带入其他无关的未提交修改。事关安全，在执行任何 `git add`，`git commit` 命令前 **必须** 使用本技能。
---

# commit-own-changes

基于 git-hunk 精准选择提交范围，防止带入其他无关的未提交修改。

## 工作流程

1. **获取锁**

防止同一时间其他 Agent 进行 Git 操作：

```bash
{skill_dir}/scripts/git-lock.sh acquire <task-id>   # Linux/macOS
```

```powershell
{skill_dir}\scripts\git-lock.ps1 -Action acquire -TaskId <task-id>   # Windows
```

`<task-id>` 建议用本次任务的极简英文 summary，如 `fix-login-crash`、`add-dark-mode`。获取锁和释放锁时必须使用同一 ID。

**重要：** acquire 会自动等待直到上一个锁释放；请不要设置超时时间，耐心等待。禁止手动检查/删除锁文件。禁止跳过本步骤进行后续操作。
若 acquire 执行失败（输出不包含 `acquired`），立即中止提交，向用户报告异常。

2. **列举修改状态**

确认有哪些 hunk 是需要提交的：

```powershell
git status             # 确认仓库状态
git-hunk list          # 全部 hunk
git-hunk list <files...>   # 或只看特定文件的 hunk
```

可以使用 `show` 确认 hunk 的内容：

```powershell
git-hunk show <hunk_ids...>
```

3. **清除暂存区**

防止过去残留的暂存项干扰本次提交：

```powershell
git restore --staged .
```

4. **暂存**

如果文件的所有改动都属于本轮提交，直接全量暂存：

```powershell
git add <files...>
```

否则用 git-hunk stage 精确选择：

```powershell
git-hunk stage <hunk_ids...>
```

与其他 Agent 修改重叠时的处理（混在同一行，无法拆分）：

- **Case 1 — 要提交 B，但 B 已基于 A 的未提交修改**：向用户说明情况，询问是否需要等待前置修改提交后再提交本修改。如用户要求等待，则恢复暂存区并释放锁。如用户同意直接一并提交，则提交 A+B 整体。在 message 中备注包含 A 的改动。
- **Case 2 — 要提交 A，但 A 之后又叠加了 B 的修改**：构造 patch 仅含 A 的部分，用 git apply --cached 暂存；B 留在工作区，留待 B 的 Agent 提交。

**构造 patch 的流程与注意事项**：

1. 优先 `git-hunk stage` / `git add -p` 选 hunk——若能独立成 hunk，不需要 patch。
2. 若必须手写 patch（A、B 混在同一行无法用 hunk 表达），写完后必须转 LF 并验证：

```powershell
$c = [System.IO.File]::ReadAllText('x.patch'); $c = $c -replace "`r`n", "`n"; [System.IO.File]::WriteAllText('x.patch', $c, (New-Object System.Text.UTF8Encoding($false)))
git apply --cached --check x.patch
```

5. **提交**

> 注意：PowerShell 不支持 heredoc，提交消息必须使用 -F - 指定

```powershell
"<type>: <title>`n`n- <file>: <changes>`n- <file>: <changes>" | git commit -F -
```

6. **释放锁**

```bash
{skill_dir}/scripts/git-lock.sh release <task-id>   # Linux/macOS
```

```powershell
{skill_dir}\scripts\git-lock.ps1 -Action release -TaskId <task-id>   # Windows
```

## 原则

- 同时有多个 Agent 在工作。请勿假设只有你自己修改过某一文件。
- 禁止 `git add -A`。
- 在适用时，建议在一行脚本内完成第 3~6 步以提高效率。例：

```powershell
git restore --staged . && git add foo.md && git-hunk stage a1b2c3 && "<type>: <title>`n`n- <file>: <changes>`n- <file>: <changes>" | git commit -F - && {skill_dir}\scripts\git-lock.ps1 -Action release -TaskId <task-id>
```
