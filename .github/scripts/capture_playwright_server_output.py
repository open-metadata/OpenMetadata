#!/usr/bin/env python3
"""Aggregate access traffic while retaining only a bounded server-log tail."""

from __future__ import annotations

import argparse
import json
import os
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

    def flush(_signal: int | None = None, _frame: object | None = None) -> None:
        atomic_write(args.log, "".join(tail))
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

    signal.signal(signal.SIGUSR1, flush)
    signal.signal(signal.SIGUSR2, reset)
    line_count = 0
    try:
        with args.input.open(encoding="utf-8", errors="replace") as server_output:
            for line in server_output:
                tail.append(line)
                accumulator.add(line)
                line_count += 1
                if line_count % 10_000 == 0:
                    flush()
    finally:
        flush()


if __name__ == "__main__":
    main()
