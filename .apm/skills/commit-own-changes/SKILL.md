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
git-hunk list
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

> 特别地：如果你和其他 Agent 的修改区域重叠（或你的改动被其他 Agent 删除/修改了），不要在本次提交中包含那一部分，但继续正常完成剩余的提交。在提交 message 中备注冲突情况并向用户说明即可。

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
