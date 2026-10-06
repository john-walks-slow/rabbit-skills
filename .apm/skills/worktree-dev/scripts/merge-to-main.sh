#!/usr/bin/env bash
# merge-to-main.sh — 把当前 worktree 的分支以无锁 CAS 方式合入主分支。
#
# 用法:
#   merge-to-main.sh [--into <branch>] [--strategy rebase|merge] [--retries N]
#
#   --into      目标分支（默认自动探测 master / main）
#   --strategy  rebase（默认，历史线性）| merge（保留分支，产生 merge commit）
#   --retries   CAS 重试上限（默认 10）
#
# 原理: master 已被 checkout 时，git push 会被 denyCurrentBranch 拒绝、
#   update-ref 会污染主工作区；唯一干净的 CAS 是在目标分支的 home worktree 内
#   执行 `git merge --ff-only <branch>` —— 只有 branch 真包含目标当前 HEAD 时
#   才成功，失败即"目标又前进了"，重新变基再试。目标未被 checkout 时退回
#   `git update-ref <ref> <new> <old>` 做原子 CAS。
#
# 退出码: 0 成功 / 1 用法或环境错误 / 2 冲突 / 3 重试耗尽 / 4 目标 worktree 不干净

set -euo pipefail

INTO=""
STRATEGY="rebase"
RETRIES=10

while [ $# -gt 0 ]; do
    case "$1" in
        --into)      INTO="${2:-}";     shift 2 ;;
        --into=*)    INTO="${1#*=}";    shift ;;
        --strategy)  STRATEGY="${2:-}"; shift 2 ;;
        --strategy=*) STRATEGY="${1#*=}"; shift ;;
        --retries)   RETRIES="${2:-}";  shift 2 ;;
        --retries=*) RETRIES="${1#*=}"; shift ;;
        -h|--help)   sed -n '2,17p' "$0"; exit 0 ;;
        *) echo "merge-to-main: unknown argument: $1" >&2; exit 1 ;;
    esac
done

case "$STRATEGY" in
    rebase|merge) ;;
    *) echo "merge-to-main: bad --strategy: $STRATEGY (want rebase|merge)" >&2; exit 1 ;;
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
if [ -n "$HOME_WT" ] && [ -n "$(git -C "$HOME_WT" status --porcelain --untracked-files=no)" ]; then
    echo "merge-to-main: target worktree is dirty: $HOME_WT" >&2
    exit 4
fi

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

    # 2) CAS：只有本分支真包含目标当前提交时才推得进去
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
