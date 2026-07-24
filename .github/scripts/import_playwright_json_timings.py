#!/usr/bin/env python3
"""Convert Playwright JSON reporter files into planner timing history."""

from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path
from typing import Any, Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-glob", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-sha", default="baseline")
    return parser.parse_args()


def iter_specs(suite: dict[str, Any]) -> Iterable[dict[str, Any]]:
    yield from suite.get("specs", [])
    for child in suite.get("suites", []):
        yield from iter_specs(child)


def main() -> None:
    args = parse_args()
    timings: dict[tuple[str, str], dict[str, Any]] = {}
    for filename in sorted(glob.glob(args.input_glob)):
        report = json.loads(Path(filename).read_text(encoding="utf-8"))
        for suite in report.get("suites", []):
            for spec in iter_specs(suite):
                for test in spec.get("tests", []):
                    if not spec.get("id"):
                        continue
                    project = test.get("projectName", "")
                    results = test.get("results", [])
                    timing = timings.setdefault(
                        (spec["id"], project),
                        {
                            "id": spec["id"],
                            "project": project,
                            "file": spec.get("file", suite.get("file", "")),
                            "title": spec.get("title", ""),
                            "durationMs": 0,
                            "attempts": 0,
                            "retries": 0,
                            "outcome": test.get("status", "unknown"),
                        },
                    )
                    timing["durationMs"] += sum(
                        int(result.get("duration", 0)) for result in results
                    )
                    timing["attempts"] += len(results)
                    timing["retries"] += max(0, len(results) - 1)

    output = {
        "version": 1,
        "mode": "full",
        "sourceSha": args.source_sha,
        "tests": sorted(
            timings.values(),
            key=lambda timing: (timing["id"], timing["project"]),
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, separators=(",", ":")) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
