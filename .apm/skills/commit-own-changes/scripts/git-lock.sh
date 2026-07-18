#!/bin/sh

LOCK_FILE="$(git rev-parse --git-dir)/agent.lock"
LOCK_AGE_LIMIT=300
WRITE_GRACE=3

read_task() {
    grep '^task=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2-
}

read_ts() {
    grep '^ts=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2
}

file_age() {
    if [ ! -f "$LOCK_FILE" ]; then
        echo ""
        return
    fi
    now=$(date +%s)
    mtime=$(stat -c %Y "$LOCK_FILE" 2>/dev/null || stat -f %m "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$mtime" ]; then
        echo $((now - mtime))
        return
    fi
    echo ""
}

try_steal_stale() {
    lock_ts=$(read_ts)
    if [ -n "$lock_ts" ]; then
        now=$(date +%s)
        lock_ts_int=$(printf "%.0f" "$lock_ts" 2>/dev/null || echo "$lock_ts" | cut -d. -f1)
        age=$((now - lock_ts_int))
        if [ "$age" -gt "$LOCK_AGE_LIMIT" ]; then
            rm -f "$LOCK_FILE"
            return 0
        fi
        return 1
    fi

    # Incomplete lock (no ts): reclaim after write grace
    age=$(file_age)
    if [ -n "$age" ] && [ "$age" -ge "$WRITE_GRACE" ]; then
        rm -f "$LOCK_FILE"
        return 0
    fi
    return 1
}

acquire() {
    task_id="$1"
    waited=false

    while true; do
        if [ -f "$LOCK_FILE" ]; then
            lock_task=$(read_task)

            if [ -n "$lock_task" ] && [ "$lock_task" = "$task_id" ]; then
                printf 'task=%s\nts=%s\n' "$task_id" "$(date +%s)" > "$LOCK_FILE"
                if [ "$(read_task)" = "$task_id" ]; then
                    echo "reacquired:$task_id"
                    return 0
                fi
            else
                if [ "$waited" = false ]; then
                    echo "waiting:${lock_task:-unknown}" >&2
                fi
                waited=true
                if try_steal_stale; then
                    continue
                fi
                sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
                continue
            fi
        fi

        # Atomic create-with-content (O_EXCL via noclobber) — no empty-lock window
        if (set -C; printf 'task=%s\nts=%s\n' "$task_id" "$(date +%s)" > "$LOCK_FILE") 2>/dev/null; then
            if [ "$(read_task)" = "$task_id" ]; then
                if [ "$waited" = true ]; then
                    echo "acquired after wait:$task_id"
                else
                    echo "acquired:$task_id"
                fi
                return 0
            fi
            rm -f "$LOCK_FILE"
        fi

        sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
    done
}

release() {
    task_id="$1"
    if [ ! -f "$LOCK_FILE" ]; then
        return 0
    fi

    lock_task=$(read_task)
    if [ -z "$lock_task" ]; then
        age=$(file_age)
        if [ -n "$age" ] && [ "$age" -ge "$WRITE_GRACE" ]; then
            rm -f "$LOCK_FILE"
            echo "released (orphaned):$task_id"
        fi
        return 0
    fi

    if [ "$lock_task" = "$task_id" ]; then
        rm -f "$LOCK_FILE" && echo "released:$task_id" || echo "failed to release lock: $LOCK_FILE" >&2
        return 0
    fi

    echo "Lock held by another task ($lock_task), skip release" >&2
}

case "${1:-}" in
    acquire) acquire "${2:-}" ;;
    release) release "${2:-}" ;;
    *) echo "Usage: $0 {acquire|release} <task-id>" >&2; exit 1 ;;
esac
