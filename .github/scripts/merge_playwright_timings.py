#!/usr/bin/env python3
"""Merge per-shard Playwright timing artifacts into one reusable history file."""

from __future__ import annotations

import argparse
import glob
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-glob", required=True)
    parser.add_argument("--mode", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    tests: dict[str, dict[str, Any]] = {}
    duplicates: dict[str, int] = defaultdict(int)
    shards: list[str] = []

    for filename in sorted(glob.glob(args.input_glob, recursive=True)):
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        shards.append(payload.get("shardId", Path(filename).parent.name))
        for timing in payload.get("tests", []):
            test_id = timing["id"]
            if test_id in tests:
                duplicates[test_id] += 1
                tests[test_id]["durationMs"] += int(timing.get("durationMs", 0))
                tests[test_id]["attempts"] += int(timing.get("attempts", 0))
                tests[test_id]["retries"] += int(timing.get("retries", 0))
                tests[test_id]["retryDurationMs"] = int(
                    tests[test_id].get("retryDurationMs", 0)
                ) + int(timing.get("retryDurationMs", 0))
            else:
                tests[test_id] = dict(timing)

    output = {
        "version": 1,
        "mode": args.mode,
        "sourceSha": args.source_sha,
        "shards": sorted(set(shards)),
        "duplicateTestIds": sorted(duplicates),
        "tests": sorted(tests.values(), key=lambda timing: timing["id"]),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
