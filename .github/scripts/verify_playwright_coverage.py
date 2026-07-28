#!/usr/bin/env python3
"""Verify planned coverage using timings and native zero-attempt skip records."""

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
    parser.add_argument("--result-glob")
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def iter_specs(suite: dict) -> list[dict]:
    specs = list(suite.get("specs", []))
    for child in suite.get("suites", []):
        specs.extend(iter_specs(child))
    return specs


def zero_attempt_skipped_tests(report: dict, executed: Counter) -> dict[str, dict]:
    skipped: dict[str, dict] = {}
    for suite in report.get("suites", []):
        for spec in iter_specs(suite):
            test_id = spec.get("id")
            if not test_id or test_id in executed:
                continue
            tests = spec.get("tests", [])
            if not tests or not all(
                test.get("status") == "skipped" and not test.get("results")
                for test in tests
            ):
                continue
            skipped[test_id] = {
                "id": test_id,
                "project": tests[0].get("projectName", ""),
                "file": spec.get("file", ""),
                "title": spec.get("title", ""),
                "category": "zero-attempt-skipped",
                "reason": "unknown",
            }
    return skipped


def main() -> None:
    args = parse_args()
    planned = Counter()
    executed = Counter()

    plan_files = sorted(glob.glob(args.plan_glob, recursive=True))
    timing_files = sorted(glob.glob(args.timing_glob, recursive=True))
    result_files = (
        sorted(glob.glob(args.result_glob, recursive=True)) if args.result_glob else []
    )
    for filename in plan_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        if "shardId" not in payload:
            continue
        planned.update(payload.get("testIds", []))

    for filename in timing_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        executed.update(test["id"] for test in payload.get("tests", []))

    zero_attempt_skipped: dict[str, dict] = {}
    for filename in result_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        zero_attempt_skipped.update(zero_attempt_skipped_tests(payload, executed))
    zero_attempt_skipped = {
        test_id: details
        for test_id, details in zero_attempt_skipped.items()
        if test_id in planned
    }

    duplicate_plans = sorted(test_id for test_id, count in planned.items() if count > 1)
    duplicate_executions = sorted(
        test_id for test_id, count in executed.items() if count > 1
    )
    missing = sorted(planned.keys() - executed.keys() - zero_attempt_skipped.keys())
    unexpected = sorted(executed.keys() - planned.keys())

    result = {
        "version": 1,
        "planFiles": len(plan_files),
        "timingFiles": len(timing_files),
        "resultFiles": len(result_files),
        "plannedTests": len(planned),
        "executedTests": len(executed),
        "accountedTests": len(executed.keys() | zero_attempt_skipped.keys()),
        "zeroAttemptSkippedTests": [
            zero_attempt_skipped[test_id] for test_id in sorted(zero_attempt_skipped)
        ],
        "zeroAttemptSkippedTestIds": sorted(zero_attempt_skipped),
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
