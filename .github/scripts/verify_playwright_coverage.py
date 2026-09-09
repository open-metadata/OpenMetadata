#!/usr/bin/env python3
"""Verify planned coverage using timings and native zero-attempt skip records."""

from __future__ import annotations

import argparse
import glob
import json
from collections import Counter
from pathlib import Path

# Playwright "setup" projects declared in playwright.config.ts as
# `dependencies: [...]` values on other projects. Their tests run once per
# shard-invocation that includes a dependent project (Playwright behaviour —
# a setup project runs before each dependent), not once per plan. The planner
# already excludes them from `FULL_PROJECTS`, so they never appear in a
# shard's `testIds`. But they DO appear in the shard's timing artifact, so
# the coverage checker used to flag them as "unexpected + duplicate" whenever
# LPT split two dependent files across shards.
#
# Example failure — merge_group run 31083026904:
#   [data-insight-application] > dataInsightApp.ts > Run Data Insight
#   application and wait until success
# ran on chromium-04 AND chromium-17 because two @data-insight spec files
# landed on separate shards, but appeared in neither plan's `testIds`.
#
# Keep this list aligned with playwright.config.ts's setup-project section.
LIFECYCLE_PROJECTS: frozenset[str] = frozenset(
    {
        "setup",
        "entity-data-setup",
        "entity-data-teardown",
        "data-insight-application",
        "search-rbac-setup",
        "search-rbac-teardown",
    }
)


def is_lifecycle_test(test: dict) -> bool:
    """A `test` from the timing artifact is a lifecycle test if its Playwright
    project name matches one of the setup projects declared in the config.
    Lifecycle tests are expected to run once per shard-invocation, not once
    per plan, so the coverage checker must exclude them from the plan-vs-exec
    reconciliation.
    """
    return test.get("project") in LIFECYCLE_PROJECTS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan-glob", required=True)
    parser.add_argument("--timing-glob", required=True)
    parser.add_argument("--result-glob")
    parser.add_argument("--require-native-evidence", action="store_true")
    parser.add_argument("--require-single-attempt", action="store_true")
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
    native = Counter()
    native_evidence_issues = []
    quarantined_tests = None

    plan_files = sorted(glob.glob(args.plan_glob, recursive=True))
    timing_files = sorted(glob.glob(args.timing_glob, recursive=True))
    result_files = (
        sorted(glob.glob(args.result_glob, recursive=True)) if args.result_glob else []
    )
    for filename in plan_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        if Path(filename).name == "quarantine-inventory.json":
            quarantined_tests = sum(
                len(spec.get("tests", []))
                for suite in payload.get("suites", [])
                for spec in iter_specs(suite)
                if any(tag.lstrip("@") == "quarantine" for tag in spec.get("tags", []))
            )
        if "shardId" not in payload:
            continue
        planned.update(payload.get("testIds", []))

    for filename in timing_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        executed.update(
            test["id"]
            for test in payload.get("tests", [])
            if not is_lifecycle_test(test)
        )

    zero_attempt_skipped: dict[str, dict] = {}
    for filename in result_files:
        payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        zero_attempt_skipped.update(zero_attempt_skipped_tests(payload, executed))
        if args.require_native_evidence or args.require_single_attempt:
            for suite in payload.get("suites", []):
                for spec in iter_specs(suite):
                    for test in spec.get("tests", []):
                        if args.require_single_attempt:
                            attempts = test.get("results", [])
                            if len(attempts) > 1 or any(
                                attempt.get("retry", 0) != 0 for attempt in attempts
                            ):
                                native_evidence_issues.append(
                                    f"More than one execution attempt: {spec.get('id')}"
                                )
                            if test.get("status") not in {"expected", "skipped"} or any(
                                attempt.get("status")
                                not in {test.get("expectedStatus", "passed"), "skipped"}
                                for attempt in attempts
                            ):
                                native_evidence_issues.append(
                                    f"Unexpected test outcome: {spec.get('id')}"
                                )
                        if test.get("projectName") in LIFECYCLE_PROJECTS:
                            continue
                        test_id = spec.get("id")
                        if not test_id:
                            native_evidence_issues.append(
                                f"Missing native test identity in {filename}"
                            )
                            continue
                        native[test_id] += 1
                        if test.get("status") != "skipped" and not test.get("results"):
                            native_evidence_issues.append(
                                f"No execution attempts for {test_id}"
                            )
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

    if args.require_native_evidence or args.require_single_attempt:
        native_evidence_issues.extend(
            f"Missing native result: {test_id}"
            for test_id in sorted(planned.keys() - native.keys())
        )
        native_evidence_issues.extend(
            f"Unexpected native result: {test_id}"
            for test_id in sorted(native.keys() - planned.keys())
        )
        native_evidence_issues.extend(
            f"Duplicate native result: {test_id}"
            for test_id, count in native.items()
            if count > 1
        )
        if not planned:
            native_evidence_issues.append("No tests were planned")
    result = {
        "version": 1,
        "nativeEvidenceIssues": native_evidence_issues,
        "quarantinedTests": quarantined_tests,
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

    failures = (
        duplicate_plans
        + duplicate_executions
        + missing
        + unexpected
        + native_evidence_issues
    )
    if failures:
        raise SystemExit(
            "Playwright coverage mismatch: "
            f"{len(missing)} missing, {len(unexpected)} unexpected, "
            f"{len(duplicate_plans)} duplicate plans, and "
            f"{len(duplicate_executions)} duplicate executions; "
            f"{len(native_evidence_issues)} native evidence issues"
        )


if __name__ == "__main__":
    main()
