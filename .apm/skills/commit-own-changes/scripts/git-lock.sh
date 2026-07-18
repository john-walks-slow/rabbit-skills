#!/bin/sh

LOCK_FILE="$(git rev-parse --git-dir)/agent.lock"
LOCK_AGE_LIMIT=300

acquire() {
    task_id="$1"
    waited=false

    while true; do
        if [ -f "$LOCK_FILE" ]; then
            lock_task=$(grep '^task=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2-)

            # Same TaskId already holds the lock — reacquire (refresh ts)
            if [ -n "$lock_task" ] && [ "$lock_task" = "$task_id" ]; then
                printf 'task=%s\nts=%s\n' "$task_id" "$(date +%s)" > "$LOCK_FILE"
                echo "reacquired:$task_id"
                return 0
            fi

            if [ "$waited" = false ]; then
                echo "waiting:${lock_task:-unknown}" >&2
            fi
            waited=true

            lock_ts=$(grep '^ts=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2)
            if [ -n "$lock_ts" ]; then
                now=$(date +%s)
                lock_ts_int=$(printf "%.0f" "$lock_ts" 2>/dev/null || echo "$lock_ts" | cut -d. -f1)
                age=$((now - lock_ts_int))
                if [ "$age" -gt "$LOCK_AGE_LIMIT" ]; then
                    rm -f "$LOCK_FILE"
                    continue
                fi
            fi

            sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
            continue
        fi

        if (set -C; printf 'task=%s\nts=%s\n' "$task_id" "$(date +%s)" > "$LOCK_FILE") 2>/dev/null; then
            if [ "$waited" = true ]; then
                echo "acquired after wait:$task_id"
            else
                echo "acquired:$task_id"
            fi
            return 0
        fi

        # Race: another process created the lock between check and create
        sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
    done
}

release() {
    task_id="$1"
    if [ ! -f "$LOCK_FILE" ]; then
        return 0
    fi

    lock_task=$(grep '^task=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2-)
    if [ -z "$lock_task" ]; then
        rm -f "$LOCK_FILE"
        echo "released (orphaned):$task_id"
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
