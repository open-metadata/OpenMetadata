#!/usr/bin/env python3
"""Aggregate access traffic while retaining only a bounded server-log tail."""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
from collections import deque
from pathlib import Path

from summarize_playwright_requests import RequestAccumulator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--metrics", type=Path, required=True)
    parser.add_argument("--shard-id", required=True)
    parser.add_argument("--tail-lines", type=int, default=5000)
    return parser.parse_args()


def atomic_write(path: Path, content: str) -> None:
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(path)


def main() -> None:
    args = parse_args()
    args.log.parent.mkdir(parents=True, exist_ok=True)
    args.metrics.parent.mkdir(parents=True, exist_ok=True)
    accumulator = RequestAccumulator()
    tail: deque[str] = deque(maxlen=args.tail_lines)
    # DEBUG (GlossaryInheritedReviewerApproval flake): keep workflow-trigger lines that the
    # 5000-line tail would drop. Appended last because the diagnostics step tails this file.
    kept: deque[str] = deque(maxlen=3000)
    keep_pattern = re.compile(
        r"WFDBG|skipping unfilled change_event gap|could not process change event"
        r"|\[WorkflowFailure\]|\] Failure:|WorkflowEventConsumer - Error|Tick of alert"
    )
    keeping = False

    def flush(_signal: int | None = None, _frame: object | None = None) -> None:
        atomic_write(
            args.log,
            "".join(tail) + "\n===== WFDBG RETAINED LINES =====\n" + "".join(kept),
        )
        atomic_write(
            args.metrics,
            json.dumps(accumulator.payload(args.shard_id), indent=2) + "\n",
        )

    def reset(_signal: int, _frame: object | None) -> None:
        nonlocal accumulator, line_count
        accumulator = RequestAccumulator()
        tail.clear()
        line_count = 0
        flush()

    def terminate(_signal: int, _frame: object | None) -> None:
        raise SystemExit(0)

    signal.signal(signal.SIGUSR1, flush)
    signal.signal(signal.SIGUSR2, reset)
    signal.signal(signal.SIGTERM, terminate)
    line_count = 0
    try:
        # Startup can stall before the first periodic flush or before the FIFO opens.
        flush()
        with args.input.open(encoding="utf-8", errors="replace") as server_output:
            for line in server_output:
                tail.append(line)
                if keep_pattern.search(line):
                    kept.append(line)
                    keeping = True
                elif keeping and (line[:1] in ("\t", " ") or line.startswith("Caused by")):
                    kept.append(line)
                else:
                    keeping = False
                accumulator.add(line)
                line_count += 1
                if line_count % 10_000 == 0:
                    flush()
    finally:
        flush()


if __name__ == "__main__":
    main()
