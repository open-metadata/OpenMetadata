#!/bin/bash
# Thread and CPU monitor for OpenMetadata reindexing
# Usage: ./bin/thread-monitor.sh <PID> [interval_seconds]
#
# Monitors:
# - Thread count by name prefix (reindex-*, om-*, etc.)
# - Total thread count over time
# - CPU usage per thread group
# - Ever-increasing thread detection

PID=${1:?Usage: $0 <PID> [interval_seconds]}
INTERVAL=${2:-5}
LOG_DIR="/tmp/om-thread-monitor"
mkdir -p "$LOG_DIR"

THREAD_LOG="$LOG_DIR/threads.csv"
SUMMARY_LOG="$LOG_DIR/summary.log"
PREV_COUNTS_FILE="$LOG_DIR/.prev_counts"

echo "timestamp,total_threads,reindex_threads,om_threads,virtual_threads,pool_threads,fjp_threads" > "$THREAD_LOG"
echo "" > "$SUMMARY_LOG"

echo "=== OpenMetadata Thread Monitor ==="
echo "PID: $PID"
echo "Interval: ${INTERVAL}s"
echo "Logs: $LOG_DIR"
echo "Press Ctrl+C to stop and see summary"
echo ""

iteration=0

monitor() {
    local ts=$(date '+%H:%M:%S')

    # Get all threads for this process
    local thread_dump=$(jstack "$PID" 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo "[$ts] ERROR: Cannot get thread dump for PID $PID (process may have exited)"
        return 1
    fi

    # Count threads by category
    local total=$(echo "$thread_dump" | grep -c '^"')
    local reindex=$(echo "$thread_dump" | grep -c '^"reindex-')
    local om=$(echo "$thread_dump" | grep -c '^"om-')
    local virtual=$(echo "$thread_dump" | grep -c 'VirtualThread')
    local pool=$(echo "$thread_dump" | grep -c '^"pool-')
    local fjp=$(echo "$thread_dump" | grep -c '^"ForkJoinPool')

    echo "$ts,$total,$reindex,$om,$virtual,$pool,$fjp" >> "$THREAD_LOG"

    # Detailed breakdown
    echo "[$ts] total=$total | reindex=$reindex | om=$om | virtual=$virtual | pool=$pool | fjp=$fjp"

    # Every 3rd iteration, show detailed reindex thread breakdown
    if [ $((iteration % 3)) -eq 0 ]; then
        echo "  Reindex breakdown:"
        echo "$thread_dump" | grep '^"reindex-' | sed 's/".*//' | sed 's/"//g' | sed 's/-[0-9]*$//' | sort | uniq -c | sort -rn | head -15 | while read count name; do
            printf "    %-45s %d\n" "$name" "$count"
        done

        # Show unnamed/pool threads (potential leaks)
        local unnamed=$(echo "$thread_dump" | grep '^"pool-' | sed 's/".*//' | sed 's/"//g' | sort | uniq -c | sort -rn)
        if [ -n "$unnamed" ]; then
            echo "  Unnamed pool threads (potential leaks):"
            echo "$unnamed" | head -10 | while read count name; do
                printf "    %-45s %d\n" "$name" "$count"
            done
        fi
    fi

    # Detect growth: compare with previous counts
    if [ -f "$PREV_COUNTS_FILE" ]; then
        local prev_total=$(cat "$PREV_COUNTS_FILE" | head -1)
        local delta=$((total - prev_total))
        if [ $delta -gt 10 ]; then
            echo "  ⚠ THREAD GROWTH: +$delta threads since last check"
        fi
    fi
    echo "$total" > "$PREV_COUNTS_FILE"

    # Check for RUNNABLE threads (CPU consumers)
    if [ $((iteration % 6)) -eq 0 ]; then
        echo "  Top RUNNABLE threads (CPU consumers):"
        echo "$thread_dump" | grep -B1 'java.lang.Thread.State: RUNNABLE' | grep '^"' | sed 's/".*//' | sed 's/"//g' | sed 's/-[0-9]*$//' | sort | uniq -c | sort -rn | head -10 | while read count name; do
            printf "    %-45s %d RUNNABLE\n" "$name" "$count"
        done
    fi

    # Every 12th iteration, save a full thread dump
    if [ $((iteration % 12)) -eq 0 ] && [ $iteration -gt 0 ]; then
        local dump_file="$LOG_DIR/thread-dump-$(date '+%H%M%S').txt"
        echo "$thread_dump" > "$dump_file"
        echo "  [Saved full thread dump to $dump_file]"
    fi

    iteration=$((iteration + 1))
}

cleanup() {
    echo ""
    echo "=== SUMMARY ==="
    echo "Thread count over time:"
    cat "$THREAD_LOG"
    echo ""
    echo "Check $LOG_DIR for detailed logs and thread dumps"
    exit 0
}

trap cleanup INT TERM

while true; do
    monitor || exit 1
    sleep "$INTERVAL"
done
