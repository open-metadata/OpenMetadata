#!/usr/bin/env python3
"""Refuse a passing PR check when a changed spec has no passing execution."""

from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path


def passing_specs(report: dict, test_dir: str) -> tuple[set[str], set[str]]:
    passed: set[str] = set()
    failed: set[str] = set()

    def visit(suite: dict, parent_file: str = "") -> None:
        file = suite.get("file", parent_file).replace("\\", "/")
        for spec in suite.get("specs", []):
            source = spec.get("file", file)
            if "/playwright/" in source:
                source = "playwright/" + source.split("/playwright/", 1)[1]
            elif not source.startswith("playwright/"):
                source = f"{test_dir}/{source}"
            for test in spec.get("tests", []):
                results = test.get("results", [])
                if not results:
                    continue
                status = results[-1].get("status")
                if status == "skipped":
                    continue
                if status == test.get("expectedStatus", "passed"):
                    passed.add(source)
                else:
                    failed.add(source)
        for child in suite.get("suites", []):
            visit(child, file)

    for suite in report.get("suites", []):
        visit(suite)
    return passed, failed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--specs-json", required=True)
    parser.add_argument("--report-glob", action="append", required=True)
    parser.add_argument("--test-dir", default="playwright/e2e")
    args = parser.parse_args()
    expected = set(json.loads(args.specs_json))
    if not expected:
        raise SystemExit("A changed-spec execution check requires a nonempty spec list")
    passed: set[str] = set()
    failed: set[str] = set()
    for pattern in args.report_glob:
        for path in glob.glob(pattern, recursive=True):
            report_passed, report_failed = passing_specs(
                json.loads(Path(path).read_text()), args.test_dir
            )
            passed.update(report_passed)
            failed.update(report_failed)
    missing = expected - passed
    failures = expected & failed
    if missing or failures:
        raise SystemExit(
            "Changed Playwright specs did not pass execution: "
            + ", ".join(sorted(missing | failures))
            + (
                ". Entirely skipped specs do not count. PR jobs have no private "
                "credentials; provide local or mock fixtures."
                if missing
                else ""
            )
        )
    print(f"Verified passing execution of all {len(expected)} changed specs")


if __name__ == "__main__":
    main()
