#!/usr/bin/env bash
# merge-to-main.sh — 把当前 worktree 的分支以无锁 CAS 方式合入主分支。
#
# 用法:
#   merge-to-main.sh [--into <branch>] [--strategy rebase|merge] [--retries N] [--wait[=秒]]
#
#   --into      目标分支（默认自动探测 master / main）
#   --strategy  rebase（默认，历史线性）| merge（保留分支，产生 merge commit）
#   --retries   CAS 重试上限（默认 10）
#   --wait      目标工作区有未提交改动时不立刻退 4，而是等它变干净——默认等 3600 秒，
#               可跟一个秒数（`--wait 600` / `--wait=600`）。多 agent 并行时用它对
#               「主工作区正被另一路占着」排队；脏的判据与不加 --wait 时是同一条。
#
# 原理: master 已被 checkout 时，git push 会被 denyCurrentBranch 拒绝、
#   update-ref 会污染主工作区；唯一干净的 CAS 是在目标分支的 home worktree 内
#   执行 `git merge --ff-only <branch>` —— 只有 branch 真包含目标当前 HEAD 时
#   才成功，失败即"目标又前进了"，重新变基再试。目标未被 checkout 时退回
#   `git update-ref <ref> <new> <old>` 做原子 CAS。
#
# 退出码: 0 成功 / 1 用法或环境错误 / 2 冲突 / 3 重试耗尽 / 4 目标 worktree 不干净（--wait 下 = 等满时限仍脏）

set -euo pipefail

INTO=""
STRATEGY="rebase"
RETRIES=10
WAIT=0
WAIT_DEFAULT=3600

while [ $# -gt 0 ]; do
    case "$1" in
        --into)      INTO="${2:-}";     shift 2 ;;
        --into=*)    INTO="${1#*=}";    shift ;;
        --strategy)  STRATEGY="${2:-}"; shift 2 ;;
        --strategy=*) STRATEGY="${1#*=}"; shift ;;
        --retries)   RETRIES="${2:-}";  shift 2 ;;
        --retries=*) RETRIES="${1#*=}"; shift ;;
        # 裸 --wait 用默认时限；后面直接跟一串数字就当秒数收掉
        --wait)      if [ -n "${2:-}" ] && [ -z "${2//[0-9]/}" ]; then WAIT="$2"; shift 2; else WAIT="$WAIT_DEFAULT"; shift; fi ;;
        --wait=*)    WAIT="${1#*=}"; shift ;;
        -h|--help)   sed -n '2,19p' "$0"; exit 0 ;;
        *) echo "merge-to-main: unknown argument: $1" >&2; exit 1 ;;
    esac
done

case "$STRATEGY" in
    rebase|merge) ;;
    *) echo "merge-to-main: bad --strategy: $STRATEGY (want rebase|merge)" >&2; exit 1 ;;
esac
case "$WAIT" in
    ''|*[!0-9]*) echo "merge-to-main: bad --wait: $WAIT (want a non-negative integer seconds)" >&2; exit 1 ;;
esac
case "$RETRIES" in
    ''|*[!0-9]*) echo "merge-to-main: bad --retries: $RETRIES" >&2; exit 1 ;;
esac

git rev-parse --git-dir >/dev/null 2>&1 || { echo "merge-to-main: not inside a git worktree" >&2; exit 1; }
WT_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git symbolic-ref --short -q HEAD)" || { echo "merge-to-main: detached HEAD — checkout a branch first" >&2; exit 1; }

if [ -z "$INTO" ]; then
    for cand in master main; do
        if git show-ref -q --verify "refs/heads/$cand"; then INTO="$cand"; break; fi
    done
fi
[ -n "$INTO" ] || { echo "merge-to-main: cannot detect target branch, pass --into" >&2; exit 1; }
[ "$BRANCH" != "$INTO" ] || { echo "merge-to-main: already on target branch $INTO" >&2; exit 1; }

# 目标分支的 home worktree —— CAS 必须在它的工作区内落地
HOME_WT="$(git worktree list --porcelain | awk -v ref="refs/heads/$INTO" '
    /^worktree / { wt = substr($0, 10) }
    /^branch /   { if ($2 == ref) print wt }')"

if [ -n "$(git -C "$WT_ROOT" status --porcelain --untracked-files=no)" ]; then
    echo "merge-to-main: dirty worktree $WT_ROOT — commit or discard tracked changes first" >&2
    exit 1
fi
# 目标工作区脏：不带 --wait 就直接退 4；带了就等到它干净（或等满时限）。
# 判据与「不等待」那条同源——只认已跟踪改动，未跟踪文件不拦。
home_dirty() { [ -n "$(git -C "$HOME_WT" status --porcelain --untracked-files=no)" ]; }

await_home_clean() {
    [ -n "$HOME_WT" ] || return 0
    home_dirty || return 0
    if [ "$WAIT" -le 0 ]; then
        echo "merge-to-main: target worktree is dirty: $HOME_WT" >&2
        echo "merge-to-main: 去目标工作区处理，或加 --wait[=秒] 等它自己变干净" >&2
        return 4
    fi
    echo "merge-to-main: target worktree is dirty: $HOME_WT — waiting up to ${WAIT}s for it to become clean"
    WAIT_DEADLINE=$(( $(date +%s) + WAIT ))
    while home_dirty; do
        if [ "$(date +%s)" -ge "$WAIT_DEADLINE" ]; then
            echo "merge-to-main: still dirty after ${WAIT}s (处理完重跑，或加大 --wait)" >&2
            return 4
        fi
        sleep 5
    done
    echo "merge-to-main: target worktree is clean now, proceeding"
    return 0
}

await_home_clean || exit 4

attempt=1
while [ "$attempt" -le "$RETRIES" ]; do
    [ "$attempt" -eq 1 ] || echo "merge-to-main: $INTO moved, retry $attempt/$RETRIES" >&2

    # 1) 让本分支建立在目标分支最新提交之上
    if [ "$STRATEGY" = rebase ]; then
        if ! git -C "$WT_ROOT" rebase "$INTO" >/dev/null 2>&1; then
            CONFLICTS="$(git -C "$WT_ROOT" diff --name-only --diff-filter=U 2>/dev/null | tr '\n' ' ' | sed 's/ $//' || true)"
            git -C "$WT_ROOT" rebase --abort >/dev/null 2>&1 || true
            echo "merge-to-main: rebase conflict against $INTO in: ${CONFLICTS:-<unknown>}" >&2
            echo "merge-to-main: $BRANCH restored — run 'git -C $WT_ROOT rebase $INTO', resolve, then re-run this script" >&2
            exit 2
        fi
    else
        if ! git -C "$WT_ROOT" merge --no-edit "$INTO" >/dev/null 2>&1; then
            CONFLICTS="$(git -C "$WT_ROOT" diff --name-only --diff-filter=U 2>/dev/null | tr '\n' ' ' | sed 's/ $//' || true)"
            git -C "$WT_ROOT" merge --abort >/dev/null 2>&1 || true
            echo "merge-to-main: merge conflict against $INTO in: ${CONFLICTS:-<unknown>}" >&2
            echo "merge-to-main: $BRANCH restored — run 'git -C $WT_ROOT merge $INTO', resolve, commit, then re-run this script" >&2
            exit 2
        fi
    fi

    # 2) CAS：只有本分支真包含目标当前提交时才推得进去。
    # 变基那几秒里目标可能又被改脏——脏着落 CAS 就绕过了目标工作区的保护，
    # 所以落地前再拦一次（带 --wait 就继续等，不带就退 4）。
    await_home_clean || exit 4
    if [ -n "$HOME_WT" ]; then
        if git -C "$HOME_WT" merge --ff-only "$BRANCH" >/dev/null 2>&1; then
            echo "merged: $BRANCH -> $INTO ($(git -C "$HOME_WT" rev-parse --short HEAD))"
            exit 0
        fi
    else
        if git update-ref "refs/heads/$INTO" "$(git rev-parse "$BRANCH")" "$(git rev-parse "refs/heads/$INTO")" 2>/dev/null; then
            echo "merged: $BRANCH -> $INTO ($(git rev-parse --short "refs/heads/$INTO"))"
            exit 0
        fi
    fi

    attempt=$((attempt + 1))
    sleep 0.3
done

echo "merge-to-main: gave up after $RETRIES attempts — $INTO keeps moving" >&2
exit 3
