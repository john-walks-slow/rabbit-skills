#!/bin/sh

LOCK_FILE="$(git rev-parse --git-dir)/agent.lock"

acquire() {
    task_id="$1"
    waited=false
    while true; do
        if [ -f "$LOCK_FILE" ]; then
            waited=true
            lock_ts=$(grep '^ts=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2)
            if [ -n "$lock_ts" ]; then
                now=$(date +%s)
                lock_ts_int=$(printf "%.0f" "$lock_ts" 2>/dev/null || echo "$lock_ts" | cut -d. -f1)
                age=$((now - lock_ts_int))
                if [ "$age" -gt 300 ]; then
                    rm -f "$LOCK_FILE"
                    echo "Cleaned up expired lock (age: $((age / 60)).$((age % 60))m)" >&2
                    continue
                fi
            fi
        fi

        if (set -C; printf 'task=%s\nts=%s\n' "$task_id" "$(date +%s)" > "$LOCK_FILE") 2>/dev/null; then
            if [ "$waited" = true ]; then
                echo "acquired after wait:$task_id"
            else
                echo "acquired:$task_id"
            fi
            return 0
        fi

        sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
    done
}

release() {
    task_id="$1"
    if [ -f "$LOCK_FILE" ]; then
        lock_task=$(grep '^task=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2-)
        if [ "$lock_task" = "$task_id" ]; then
            rm -f "$LOCK_FILE" && echo "released:$task_id" || echo "释放锁文件失败: $LOCK_FILE" >&2
        elif [ -z "$lock_task" ]; then
            rm -f "$LOCK_FILE"
            echo "released (orphaned):$task_id"
        else
            echo "锁由其他任务持有 (Task $lock_task)，跳过释放" >&2
        fi
    fi
}

case "${1:-}" in
    acquire) acquire "${2:-}" ;;
    release) release "${2:-}" ;;
    *) echo "Usage: $0 {acquire|release} <task-id>" >&2; exit 1 ;;
esac
