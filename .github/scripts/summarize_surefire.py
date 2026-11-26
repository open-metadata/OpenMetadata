#!/usr/bin/env python3
#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Summarize Java checkstyle and Surefire unit-test results for GitHub Actions."""

from __future__ import annotations

import argparse
import glob
import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TestFailure:
    classname: str
    name: str
    kind: str  # "FAILURE" or "ERROR"
    error_type: str
    message: str
    detail: str


@dataclass(frozen=True)
class SuiteSummary:
    report_count: int
    tests: int
    failures: int
    errors: int
    skipped: int
    time_seconds: float
    failed_cases: tuple[TestFailure, ...]

    @property
    def passed(self) -> int:
        return max(0, self.tests - self.failures - self.errors - self.skipped)


def parse_surefire_reports(report_globs: list[str]) -> SuiteSummary:
    paths: list[Path] = []
    seen: set[Path] = set()
    for pattern in report_globs:
        for match in sorted(glob.glob(pattern, recursive=True)):
            path = Path(match)
            if path.is_file() and path not in seen:
                seen.add(path)
                paths.append(path)

    total_tests = 0
    total_failures = 0
    total_errors = 0
    total_skipped = 0
    total_time = 0.0
    failed_cases: list[TestFailure] = []

    for path in paths:
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            failed_cases.append(
                TestFailure(
                    classname=path.name,
                    name="<unparseable XML report>",
                    kind="ERROR",
                    error_type="XMLParseError",
                    message=f"Could not parse Surefire report {path}",
                    detail="",
                )
            )
            total_errors += 1
            continue

        suites = [root] if root.tag == "testsuite" else list(root.findall(".//testsuite"))
        for suite in suites:
            total_tests += int(suite.attrib.get("tests", 0))
            total_failures += int(suite.attrib.get("failures", 0))
            total_errors += int(suite.attrib.get("errors", 0))
            total_skipped += int(suite.attrib.get("skipped", 0))
            try:
                total_time += float(suite.attrib.get("time", 0.0))
            except ValueError:
                pass

            for case in suite.findall("testcase"):
                classname = case.attrib.get("classname") or suite.attrib.get("name", "<unknown>")
                name = case.attrib.get("name", "<unknown>")
                for tag, kind in (("failure", "FAILURE"), ("error", "ERROR")):
                    node = case.find(tag)
                    if node is not None:
                        error_type = node.attrib.get("type", kind)
                        raw_msg = (node.attrib.get("message") or "").strip()
                        raw_body = (node.text or "").strip()
                        first_line = raw_msg.splitlines()[0] if raw_msg else (
                            raw_body.splitlines()[0] if raw_body else kind
                        )
                        failed_cases.append(
                            TestFailure(
                                classname=classname,
                                name=name,
                                kind=kind,
                                error_type=error_type,
                                message=first_line[:300],
                                detail=raw_body[:1500],
                            )
                        )
                        break

    return SuiteSummary(
        report_count=len(paths),
        tests=total_tests,
        failures=total_failures,
        errors=total_errors,
        skipped=total_skipped,
        time_seconds=total_time,
        failed_cases=tuple(failed_cases),
    )


def _badge(outcome: str) -> str:
    return {
        "success": "PASS",
        "failure": "FAIL",
        "skipped": "SKIPPED",
        "cancelled": "CANCELLED",
    }.get(outcome, outcome.upper() if outcome else "UNKNOWN")


def _stage_result(outcome: str) -> str:
    return {
        "success": "passed",
        "failure": "failed",
        "skipped": "skipped",
        "cancelled": "cancelled",
    }.get(outcome, "not completed")


def _escape_md(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ").replace("\r", "")


def _escape_annotation(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def render_markdown(
    *,
    title: str,
    checkstyle_outcome: str,
    checkstyle_files: list[str],
    unit_tests_outcome: str,
    summary: SuiteSummary,
    max_failures: int = 30,
) -> str:
    lines: list[str] = [
        f"## {title}",
        "",
        f"**Java checkstyle {_stage_result(checkstyle_outcome)}; "
        f"unit tests {_stage_result(unit_tests_outcome)}.**",
        "",
    ]
    lines.append("| Stage | Status | Details |")
    lines.append("|---|---|---|")

    cs_detail = (
        f"{len(checkstyle_files)} file(s) need formatting (`mvn spotless:apply`)"
        if checkstyle_outcome == "failure" and checkstyle_files
        else ("Formatting clean" if checkstyle_outcome == "success" else checkstyle_outcome)
    )
    lines.append(f"| Java Checkstyle | **{_badge(checkstyle_outcome)}** | {cs_detail} |")

    if unit_tests_outcome == "skipped":
        ut_detail = (
            "Skipped (fail-fast: fix checkstyle first)"
            if checkstyle_outcome == "failure"
            else "No Java service paths changed"
        )
    elif summary.report_count == 0 and unit_tests_outcome == "failure":
        ut_detail = "Build/compilation failed before Surefire produced any test reports"
    elif summary.report_count > 0:
        ut_detail = (
            f"{summary.passed}/{summary.tests} passed, "
            f"{summary.failures} failed, {summary.errors} errors, "
            f"{summary.skipped} skipped ({summary.time_seconds:.1f}s)"
        )
    else:
        ut_detail = unit_tests_outcome
    lines.append(f"| Unit Tests | **{_badge(unit_tests_outcome)}** | {ut_detail} |")
    lines.append("")

    if checkstyle_outcome == "failure":
        lines.extend(
            [
                "### Java Checkstyle Failed",
                "",
                "Run `mvn spotless:apply` in the repository root and commit the changes "
                "(or install pre-commit hooks with `make install_test precommit_install`).",
                "",
            ]
        )
        if checkstyle_files:
            lines.append("Files requiring formatting:")
            for path in checkstyle_files[:50]:
                lines.append(f"- `{path}`")
            if len(checkstyle_files) > 50:
                lines.append(f"- ...and {len(checkstyle_files) - 50} more file(s)")
            lines.append("")

    if summary.failed_cases:
        shown = summary.failed_cases[:max_failures]
        lines.extend(
            [
                f"### Failed Unit Tests ({len(summary.failed_cases)})",
                "",
                "| Test | Kind | Error |",
                "|---|---|---|",
            ]
        )
        for item in shown:
            short_class = item.classname.rsplit(".", 1)[-1]
            lines.append(
                f"| `{_escape_md(short_class)}#{_escape_md(item.name)}` "
                f"| {item.kind} | `{_escape_md(item.error_type)}`: {_escape_md(item.message)} |"
            )
        if len(summary.failed_cases) > max_failures:
            lines.append(
                f"\n_Showing first {max_failures} of {len(summary.failed_cases)} failures. "
                "Download the `surefire-reports` artifact for full logs._"
            )
        lines.append("")

        details_to_show = [c for c in shown[:10] if c.detail]
        if details_to_show:
            lines.append("<details><summary>Failure stack-trace excerpts (first 10)</summary>")
            lines.append("")
            for item in details_to_show:
                lines.append(f"#### `{item.classname}#{item.name}`")
                lines.append("```text")
                lines.append(item.detail)
                lines.append("```")
            lines.append("</details>")
            lines.append("")
    elif unit_tests_outcome == "failure" and summary.report_count == 0:
        lines.extend(
            [
                "### Build / Compilation Failed",
                "",
                "Maven exited non-zero before Surefire wrote any `TEST-*.xml` reports. "
                "Inspect the Maven compilation output in this job's log.",
                "",
            ]
        )

    return "\n".join(lines)


def format_annotations(
    *,
    checkstyle_outcome: str,
    checkstyle_files: list[str],
    unit_tests_outcome: str,
    summary: SuiteSummary,
    max_annotations: int = 10,
) -> list[str]:
    annotations: list[str] = []
    if checkstyle_outcome == "failure":
        if checkstyle_files:
            for path in checkstyle_files[:max_annotations]:
                annotations.append(
                    f"::error file={path},title=Java Checkstyle Failed::"
                    "File is not formatted. Run 'mvn spotless:apply' and commit the changes."
                )
        else:
            annotations.append(
                "::error title=Java Checkstyle Failed::"
                "Run 'mvn spotless:apply' in the repository root and commit the changes."
            )
    for item in summary.failed_cases[:max_annotations]:
        short_class = item.classname.rsplit(".", 1)[-1]
        msg = _escape_annotation(f"{item.error_type}: {item.message}")
        annotations.append(f"::error title=Unit Test Failed: {short_class}#{item.name}::{msg}")
    if unit_tests_outcome == "failure" and summary.report_count == 0:
        annotations.append(
            "::error title=Backend Build Failed::"
            "Maven exited non-zero before Surefire produced any test reports. Check compiler errors."
        )
    return annotations


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--title", default="Backend CI Summary")
    parser.add_argument("--checkstyle-outcome", default="skipped")
    parser.add_argument("--checkstyle-files", default="")
    parser.add_argument("--unit-tests-outcome", default="skipped")
    parser.add_argument("--report-glob", action="append", default=[])
    parser.add_argument("--max-failures", type=int, default=30)
    parser.add_argument("--summary-file", default=os.environ.get("GITHUB_STEP_SUMMARY", ""))
    parser.add_argument("--emit-annotations", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    cs_files: list[str] = []
    if args.checkstyle_files and Path(args.checkstyle_files).is_file():
        cs_files = [
            line.strip()
            for line in Path(args.checkstyle_files).read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    summary = parse_surefire_reports(args.report_glob)
    markdown = render_markdown(
        title=args.title,
        checkstyle_outcome=args.checkstyle_outcome,
        checkstyle_files=cs_files,
        unit_tests_outcome=args.unit_tests_outcome,
        summary=summary,
        max_failures=args.max_failures,
    )
    if args.summary_file:
        with open(args.summary_file, "a", encoding="utf-8") as fh:
            fh.write(markdown + "\n")
    else:
        print(markdown)

    if args.emit_annotations:
        for line in format_annotations(
            checkstyle_outcome=args.checkstyle_outcome,
            checkstyle_files=cs_files,
            unit_tests_outcome=args.unit_tests_outcome,
            summary=summary,
        ):
            print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
