---
name: commit-own-changes
description: 提交改动时防止带入其他无关的未提交修改。事关安全，在执行任何 `git add`，`git commit` 命令前 **必须** 使用本技能。
---

# commit-own-changes

提交改动时防止带入其他无关的未提交修改。

## 工作流程

1. **获取锁**（防止同一时间其他 Agent 进行 Git 操作；会自动等待直到上一个锁释放）

```bash
{skill_dir}/scripts/git-lock.sh acquire <task-id>   # Linux/macOS
```
```powershell
{skill_dir}\scripts\git-lock.ps1 -Action acquire -TaskId <task-id>   # Windows
```

> `<task-id>` 建议用本次任务的极简英文 summary，
如 `fix-login-crash`、`add-dark-mode`。获取锁和释放锁时必须使用同一 ID。

> 若 acquire 执行失败（输出不包含 `acquired`），立即中止，**不得继续后续步骤**。向用户报告异常。 

2. **查看 git 状态**，确认有哪些文件是需要提交的

```powershell
git status
```

**清除暂存**（防止过去残留的暂存项干扰本次提交）

```powershell
git restore --staged .
```

3. **分文件暂存修改**

对每个需要提交的文件，先查看变更并获取 refs：

```powershell
npx git-stage-lines diff <changed_file>
```

如果文件的所有改动都属于本轮提交、不存在混合意图，直接全量暂存：

```powershell
git add <changed_file>
```

否则用 git-stage-lines 精确选择。提供两种方式，按场景任选其一：

- **Refs（精确，推荐）** — 从 `diff` 输出的 refs（如 `+12`, `-20`）选择要暂存的行：

  ```powershell
  npx git-stage-lines <changed_file>:<refs> --json
  ```

  `+N` 写作 `N`，`-N` 保持 `-N`，例如 `git-stage-lines src/app.ts:-12,12,15,20 --json`。

- **Ranges（快速）** — 如果你知道自己改了哪些行号范围，直接按工作树行号选择：

  ```powershell
  npx git-stage-lines <changed_file> <ranges> --mode both --json
  ```

  例如 `git-stage-lines src/app.ts 10-15,20-30 --mode both --json`。

  范围是"模糊匹配"的：`10-30` 只会暂存该范围内**实际有改动**的行，中间的未改动行（如 16~19）不受影响。因此如果改了 10~15 和 20~30，`10-30` 可以一次性覆盖。

> 特别地：如果你和其他 Agent 的修改区域重叠（或你的改动被其他 Agent 删除/修改了），不要在本次提交中包含那一部分，但继续正常完成剩余的提交。在提交 message 中备注冲突情况并向用户说明即可。

4. **提交**

```powershell
git commit -m "feat: xxx" -m "详细描述每个文件的修改内容（使用用户母语）"
```

5. **释放锁**

```bash
{skill_dir}/scripts/git-lock.sh release <task-id>   # Linux/macOS
```
```powershell
{skill_dir}\scripts\git-lock.ps1 -Action release -TaskId <task-id>   # Windows
```

## 原则

- 同时有多个 Agent 在工作。请勿假设只有你自己修改过某一文件。
- 禁止 `git add -A`。
- 优先用 `git add <file>` 全量暂存（当文件所有改动都属于本轮提交时），避免不必要的逐行操作。
- 用 refs 方式时，refs 必须从 `npx git-stage-lines diff` 获取，不要凭推测。
- 用 ranges 方式时，确保 `--mode both` 以避免新增/删除行号混淆。
