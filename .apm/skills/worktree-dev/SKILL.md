---
name: worktree-dev
description: 基于 Git Worktree 的隔离开发工作流。在 worktree 中开发新功能、修复缺陷或做验证时使用；分支合并回主分支（多 worktree 并发合并无需排队加锁）见文末
user-invocable: true
---

# Git Worktree 开发工作流

## 端口必须申请，禁止硬编码（worktree 内）

本 skill 自带 `acquire-port`。**worktree 内启动的任何监听端口的进程**——dev server、e2e 实例、带 `--port` 的 CLI、mock 服务——都必须先向它申请端口，禁止写死端口号（如 `3000`）：

```bash
PORT=$({skill_dir}/scripts/acquire-port --wait)            # Linux
```

```powershell
$PORT = & "{skill_dir}\scripts\acquire-port.ps1" -Wait     # Windows
```

- 无状态、不用释放：服务起了端口自然占着，停了自然空出来。
- 放行只看内存余量，没有并发槽位上限。
- 机制、退出码、`--list` / `--exec`、环境变量见 `references/acquire-port.md`。

本约定只约束 worktree 内的服务启动，不是全机器范围的端口门禁。

## 生命周期脚本

worktree 内有两个约定脚本：

| 脚本 | 职责 |
|---|---|
| `scripts/init-worktree.sh` | 依赖安装/同步、环境初始化 |
| `scripts/dev-worktree.sh`  | 用本 skill 的 `acquire-port` 取端口 → 跑服务 → 输出访问地址 |

不存在时根据项目情况新建，不得跳过。

### dev-worktree.sh 典型结构

```bash
#!/usr/bin/env bash
set -euo pipefail
PORT=$(acquire-port --wait)         # 安装说明见 references/acquire-port.md
echo "Starting on http://127.0.0.1:${PORT}"
exec npm run dev -- --port "$PORT"
```

`dev-worktree.sh` 既用于 agent 的 e2e 测试（跑起来后验证），也用于暴露给用户 validate 和体验。

## 命名与路径

- 分支名：`feat/<name>` 或 `fix/<name>`
- worktree 路径：仓库根的 `.worktrees/<name>`（`name` 用分支名末段，**不含斜杠**）
- 仓库根 `.gitignore` 必须包含 `.worktrees/`

## 开发与验证规范

- 所有文件编辑、服务运行、测试严格限制在当前 worktree。
- 起服务前先申请端口。
- 若项目或宿主自带隔离的 e2e 实例管理方式（一条命令起停、自带端口与实例隔离），走它，不用自己管端口和实例。
- 严禁向主工作区或线上实例写入未声明的产物。
- worktree 内环境已隔离，不会有他人改动混入，可直接全量提交。
- 用户显式同意后，方可合入主分支。

## 合并回主分支（无锁 CAS）

多个 worktree 合回主分支**不需要排队加锁**：`git merge --ff-only` 本身就是 compare-and-swap —— 只有本分支真包含主分支当前提交时才推得进去，失败即“主分支被别的 worktree 推进了”，重新变基再来一轮。

用 skill 自带的脚本，不要手抄 rebase/merge 循环（`{skill_dir}` 指本 skill 的安装目录；脚本是 bash，Windows 上在 Git Bash 里跑）：

```bash
{skill_dir}/scripts/merge-to-main.sh                          # 变基到 master/main 后合入
{skill_dir}/scripts/merge-to-main.sh --into main              # 指定目标分支
{skill_dir}/scripts/merge-to-main.sh --strategy merge         # 保留分支历史（产生 merge commit）
{skill_dir}/scripts/merge-to-main.sh --retries 20             # 重试上限（默认 10）
```

脚本在**目标分支的 home worktree 内**执行 ff-only merge（主分支未被 checkout 时退回 `git update-ref <ref> <new> <old>` 原子 CAS）。为什么不用别的写法：`git push . HEAD:master` 会被 `receive.denyCurrentBranch` 拒绝，`update-ref` 到已 checkout 的分支会让那个工作区变脏。

| 退出码 | 含义 | 对策 |
|---|---|---|
| 0 | 成功 | — |
| 1 | 用法/环境错误（不在 worktree、工作区脏、已在目标分支） | 按提示修正 |
| 2 | 变基/合并冲突 | 脚本打印冲突文件后 `--abort` 还原分支；按下面「撞上冲突」流程解决后重跑 |
| 3 | 重试耗尽 | 主分支被高频推进，稍后重跑或加大 `--retries` |
| 4 | 目标 worktree 有未提交改动 | 先去主工作区处理（脚本不代劳 stash） |

### 撞上冲突

脚本只做机械动作，不替 agent 解冲突：冲突时它会打印冲突文件、`--abort` 把分支还原到调用前的状态（HEAD、工作区、rebase 中间态全部清掉），然后 exit 2。

```bash
cd <worktree>
git rebase master                 # 重放冲突现场，git status 显示 UU 标记
# 编辑冲突文件 → git add <file> → git rebase --continue
<skill_dir>/scripts/merge-to-main.sh   # 解决完重跑，通常一次过
```

解决冲突**不需要串行**——每个 worktree 各解各的，只有最后 CAS 落地那一步是串行的。

- 调用方 worktree 与目标 worktree 都必须没有未提交的**已跟踪**改动。
- 并发合并是安全的：后到者被 CAS 挡下后自动重试（日志会打 `master moved, retry N/10`）。
- 脚本只动本地分支，不 push、不删 worktree；推送与善后由用户决定。
