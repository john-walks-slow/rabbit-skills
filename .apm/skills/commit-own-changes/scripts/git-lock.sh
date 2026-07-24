#!/bin/sh
# File-based agent lock (.git/agent.lock). Paired with git-lock.ps1 — same format.

LOCK_FILE="$(git rev-parse --git-dir)/agent.lock"
LOCK_AGE_LIMIT=300
WRITE_GRACE=3

read_task_from() {
    grep '^task=' "$1" 2>/dev/null | cut -d= -f2-
}

read_ts_from() {
    grep '^ts=' "$1" 2>/dev/null | cut -d= -f2
}

read_task() {
    read_task_from "$LOCK_FILE"
}

read_ts() {
    read_ts_from "$LOCK_FILE"
}

file_age() {
    path="${1:-$LOCK_FILE}"
    if [ ! -e "$path" ]; then
        echo ""
        return
    fi
    now=$(date +%s)
    mtime=$(stat -c %Y "$path" 2>/dev/null || stat -f %m "$path" 2>/dev/null || echo "")
    if [ -n "$mtime" ]; then
        echo $((now - mtime))
        return
    fi
    echo ""
}

is_stale_file() {
    path="$1"
    lock_ts=$(read_ts_from "$path")
    if [ -n "$lock_ts" ]; then
        now=$(date +%s)
        lock_ts_int=$(printf "%.0f" "$lock_ts" 2>/dev/null || echo "$lock_ts" | cut -d. -f1)
        age=$((now - lock_ts_int))
        [ "$age" -gt "$LOCK_AGE_LIMIT" ]
        return $?
    fi
    age=$(file_age "$path")
    [ -n "$age" ] && [ "$age" -ge "$WRITE_GRACE" ]
    return $?
}

# Claim path via rename; delete only if still stale after claim. Else restore.
remove_stale_path() {
    path="$1"
    tmp="${path}.steal.$$"
    if [ -d "$path" ]; then
        mv "$path" "$tmp" 2>/dev/null || return 1
        rm -rf "$tmp"
        return 0
    fi
    mv "$path" "$tmp" 2>/dev/null || return 1
    if is_stale_file "$tmp"; then
        rm -f "$tmp"
        return 0
    fi
    if [ ! -e "$path" ]; then
        mv "$tmp" "$path" 2>/dev/null || rm -f "$tmp"
    else
        rm -f "$tmp"
    fi
    return 1
}

try_steal_stale() {
    if [ -d "$LOCK_FILE" ]; then
        # Legacy directory lock (old ps1/bat) — migrate away after grace
        age=$(file_age "$LOCK_FILE")
        legacy_ts=
        if [ -f "$LOCK_FILE/ts" ]; then
            legacy_ts=$(read_ts_from "$LOCK_FILE/ts")
        fi
        if [ -n "$legacy_ts" ]; then
            now=$(date +%s)
            lock_ts_int=$(printf "%.0f" "$legacy_ts" 2>/dev/null || echo "$legacy_ts" | cut -d. -f1)
            age=$((now - lock_ts_int))
            if [ "$age" -gt "$LOCK_AGE_LIMIT" ]; then
                remove_stale_path "$LOCK_FILE"
                return $?
            fi
            return 1
        fi
        if [ -n "$age" ] && [ "$age" -ge "$WRITE_GRACE" ]; then
            remove_stale_path "$LOCK_FILE"
            return $?
        fi
        return 1
    fi

    if [ ! -f "$LOCK_FILE" ]; then
        return 1
    fi

    if is_stale_file "$LOCK_FILE"; then
        remove_stale_path "$LOCK_FILE"
        return $?
    fi
    return 1
}

acquire() {
    task_id="$1"
    waited=false

    while true; do
        if [ -d "$LOCK_FILE" ]; then
            if [ "$waited" = false ]; then
                legacy_task=
                if [ -f "$LOCK_FILE/task" ]; then
                    legacy_task=$(read_task_from "$LOCK_FILE/task")
                fi
                echo "waiting:${legacy_task:-legacy-dir}" >&2
            fi
            waited=true
            if try_steal_stale; then
                continue
            fi
            sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
            continue
        fi

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

        # Atomic create-with-content (O_EXCL via noclobber)
        if (set -C; printf 'task=%s\nts=%s\n' "$task_id" "$(date +%s)" > "$LOCK_FILE") 2>/dev/null; then
            if [ "$(read_task)" = "$task_id" ]; then
                if [ "$waited" = true ]; then
                    echo "acquired after wait:$task_id"
                else
                    echo "acquired:$task_id"
                fi
                return 0
            fi
            # Lost ownership — park then delete only if still us
            tmp="${LOCK_FILE}.abort.$$"
            mv "$LOCK_FILE" "$tmp" 2>/dev/null && {
                if [ "$(read_task_from "$tmp")" = "$task_id" ]; then
                    rm -f "$tmp"
                elif [ ! -e "$LOCK_FILE" ]; then
                    mv "$tmp" "$LOCK_FILE" 2>/dev/null || rm -f "$tmp"
                else
                    rm -f "$tmp"
                fi
            }
        fi

        sleep "$(awk 'BEGIN{srand(); printf "0.%03d\n", 200 + int(rand() * 201)}')"
    done
}

release() {
    task_id="$1"

    if [ -d "$LOCK_FILE" ]; then
        legacy_task=
        if [ -f "$LOCK_FILE/task" ]; then
            legacy_task=$(read_task_from "$LOCK_FILE/task")
        fi
        if [ -z "$legacy_task" ]; then
            age=$(file_age "$LOCK_FILE")
            if [ -n "$age" ] && [ "$age" -ge "$WRITE_GRACE" ]; then
                tmp="${LOCK_FILE}.releasing.$$"
                mv "$LOCK_FILE" "$tmp" 2>/dev/null && rm -rf "$tmp" && echo "released (orphaned):$task_id"
            fi
            return 0
        fi
        if [ "$legacy_task" = "$task_id" ]; then
            tmp="${LOCK_FILE}.releasing.$$"
            mv "$LOCK_FILE" "$tmp" 2>/dev/null || return 0
            still=$(read_task_from "$tmp/task" 2>/dev/null || true)
            if [ "$still" = "$task_id" ]; then
                rm -rf "$tmp" && echo "released:$task_id"
            elif [ ! -e "$LOCK_FILE" ]; then
                mv "$tmp" "$LOCK_FILE" 2>/dev/null || rm -rf "$tmp"
            else
                rm -rf "$tmp"
            fi
            return 0
        fi
        echo "Lock held by another task ($legacy_task), skip release" >&2
        return 0
    fi

    if [ ! -f "$LOCK_FILE" ]; then
        return 0
    fi

    lock_task=$(read_task)
    if [ -z "$lock_task" ]; then
        age=$(file_age)
        if [ -n "$age" ] && [ "$age" -ge "$WRITE_GRACE" ]; then
            tmp="${LOCK_FILE}.releasing.$$"
            mv "$LOCK_FILE" "$tmp" 2>/dev/null || return 0
            if [ -z "$(read_task_from "$tmp")" ]; then
                rm -f "$tmp" && echo "released (orphaned):$task_id"
            elif [ ! -e "$LOCK_FILE" ]; then
                mv "$tmp" "$LOCK_FILE" 2>/dev/null || rm -f "$tmp"
            else
                rm -f "$tmp"
            fi
        fi
        return 0
    fi

    if [ "$lock_task" != "$task_id" ]; then
        echo "Lock held by another task ($lock_task), skip release" >&2
        return 0
    fi

    # Rename-claim then re-verify — avoids deleting a lock stolen/recreated under us
    tmp="${LOCK_FILE}.releasing.$$"
    mv "$LOCK_FILE" "$tmp" 2>/dev/null || return 0
    still=$(read_task_from "$tmp")
    if [ "$still" = "$task_id" ]; then
        rm -f "$tmp" && echo "released:$task_id" || echo "failed to release lock: $tmp" >&2
        return 0
    fi
    if [ ! -e "$LOCK_FILE" ]; then
        mv "$tmp" "$LOCK_FILE" 2>/dev/null || rm -f "$tmp"
    else
        rm -f "$tmp"
    fi
}

case "${1:-}" in
    acquire) acquire "${2:-}" ;;
    release) release "${2:-}" ;;
    *) echo "Usage: $0 {acquire|release} <task-id>" >&2; exit 1 ;;
esac
