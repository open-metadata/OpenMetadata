#!/usr/bin/env python3
"""Refuse a passing PR check when a changed spec has no passing execution."""

from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path

from playwright_test_requirements import reported_specs


def passing_specs(
    report: dict, test_dir: str, require_tag: str | None = None
) -> tuple[set[str], set[str]]:
    passed: set[str] = set()
    failed: set[str] = set()

    for source, spec in reported_specs(report, test_dir):
        if require_tag and require_tag.lstrip("@") not in {
            tag.lstrip("@") for tag in spec.get("tags", [])
        }:
            continue
        for test in spec.get("tests", []):
            results = test.get("results", [])
            if not results:
                if require_tag:
                    failed.add(source)
                continue
            status = results[-1].get("status")
            if status == "skipped":
                if require_tag:
                    failed.add(source)
                continue
            if status == test.get("expectedStatus", "passed"):
                passed.add(source)
            else:
                failed.add(source)
    return passed, failed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--specs-json", required=True)
    parser.add_argument("--report-glob", action="append", required=True)
    parser.add_argument("--test-dir", default="playwright/e2e")
    parser.add_argument("--require-tag")
    parser.add_argument("--required-test-ids-json", default="[]")
    args = parser.parse_args()
    expected = set(json.loads(args.specs_json))
    if not expected:
        raise SystemExit("A changed-spec execution check requires a nonempty spec list")
    passed: set[str] = set()
    failed: set[str] = set()
    executed_ids: set[str] = set()
    for pattern in args.report_glob:
        for path in glob.glob(pattern, recursive=True):
            report = json.loads(Path(path).read_text())
            report_passed, report_failed = passing_specs(
                report, args.test_dir, args.require_tag
            )
            for _, spec in reported_specs(report, args.test_dir):
                if args.require_tag and args.require_tag.lstrip("@") not in {
                    tag.lstrip("@") for tag in spec.get("tags", [])
                }:
                    continue
                for test in spec.get("tests", []):
                    results = test.get("results", [])
                    if (
                        results
                        and results[-1].get("status") != "skipped"
                        and results[-1].get("status")
                        == test.get("expectedStatus", "passed")
                    ):
                        executed_ids.add(spec.get("id", ""))
            passed.update(report_passed)
            failed.update(report_failed)
    missing = expected - passed
    failures = expected & failed
    missing_ids = set(json.loads(args.required_test_ids_json)) - executed_ids
    if missing_ids:
        raise SystemExit(
            "Credential tests did not execute successfully: "
            + ", ".join(sorted(missing_ids))
        )
    if missing or failures:
        raise SystemExit(
            "Changed Playwright specs did not pass execution: "
            + ", ".join(sorted(missing | failures))
            + (
                ". Entirely skipped specs do not count. PR jobs have no private "
                "credentials; tag credential cases @requires-secrets to run them in the queue."
                if missing
                else ""
            )
        )
    print(f"Verified passing execution of all {len(expected)} changed specs")


if __name__ == "__main__":
    main()
