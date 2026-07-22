#!/usr/bin/env python3
"""Verify that a duration-planned Playwright run executed every test exactly once."""

from __future__ import annotations

import argparse
import glob
import json
from collections import Counter
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan-glob", required=True)
    parser.add_argument("--timing-glob", required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    planned = Counter()
    executed = Counter()

    plan_files = sorted(glob.glob(args.plan_glob, recursive=True))
    timing_files = sorted(glob.glob(args.timing_glob, recursive=True))
    for filename in plan_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        if "shardId" not in payload:
            continue
        planned.update(payload.get("testIds", []))

    for filename in timing_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        executed.update(test["id"] for test in payload.get("tests", []))

    duplicate_plans = sorted(test_id for test_id, count in planned.items() if count > 1)
    duplicate_executions = sorted(
        test_id for test_id, count in executed.items() if count > 1
    )
    missing = sorted(planned.keys() - executed.keys())
    unexpected = sorted(executed.keys() - planned.keys())

    result = {
        "version": 1,
        "planFiles": len(plan_files),
        "timingFiles": len(timing_files),
        "plannedTests": len(planned),
        "executedTests": len(executed),
        "duplicatePlanTestIds": duplicate_plans,
        "duplicateExecutionTestIds": duplicate_executions,
        "missingTestIds": missing,
        "unexpectedTestIds": unexpected,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    failures = duplicate_plans + duplicate_executions + missing + unexpected
    if failures:
        raise SystemExit(
            "Playwright coverage mismatch: "
            f"{len(missing)} missing, {len(unexpected)} unexpected, "
            f"{len(duplicate_plans)} duplicate plans, and "
            f"{len(duplicate_executions)} duplicate executions"
        )


if __name__ == "__main__":
    main()
