"""Classify a CI test process from its exit state, JUnit reports, and diagnostics."""

import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from xml.etree import ElementTree

HANG_EXIT_CODES = {124}
HANG_PATTERN = re.compile(
    r"(?:fork(?:ed)?(?:\s+(?:process|vm))?|test process|command|process)"
    r".{0,80}(?:timed out|timeout)|"
    r"(?:timed out|timeout).{0,80}"
    r"(?:fork(?:ed)?(?:\s+(?:process|vm))?|test process|command|process)",
    re.IGNORECASE | re.DOTALL,
)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _junit_counts(
    report_files: list[Path],
) -> tuple[dict[str, int], list[dict[str, str]], list[str]]:
    totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    failed_tests = []
    parse_errors = []
    for report_file in report_files:
        try:
            root = ElementTree.parse(report_file).getroot()
        except (ElementTree.ParseError, OSError) as error:
            parse_errors.append(f"{report_file}: {error}")
            continue

        test_cases = [
            element for element in root.iter() if _local_name(element.tag) == "testcase"
        ]
        if test_cases:
            totals["tests"] += len(test_cases)
            for test_case in test_cases:
                children_by_name = {
                    _local_name(child.tag): child for child in test_case
                }
                child_names = set(children_by_name)
                totals["failures"] += int("failure" in child_names)
                totals["errors"] += int("error" in child_names)
                totals["skipped"] += int("skipped" in child_names)
                for failure_type in ("failure", "error"):
                    failure = children_by_name.get(failure_type)
                    if failure is None:
                        continue
                    class_name = test_case.attrib.get("classname", "")
                    test_name = test_case.attrib.get("name", "")
                    failed_tests.append(
                        {
                            "id": f"{class_name}#{test_name}",
                            "className": class_name,
                            "name": test_name,
                            "type": failure_type,
                            "message": failure.attrib.get("message", "")[:1000],
                            "report": str(report_file),
                        }
                    )
            continue

        if _local_name(root.tag) in {"testsuite", "testsuites"}:
            for key in totals:
                try:
                    totals[key] += int(root.attrib.get(key, "0"))
                except ValueError:
                    parse_errors.append(
                        f"{report_file}: invalid {key} count {root.attrib.get(key)!r}"
                    )
    return totals, failed_tests, parse_errors


def _contains_process_timeout(diagnostic_files: list[Path]) -> bool:
    for diagnostic_file in diagnostic_files:
        try:
            with diagnostic_file.open("rb") as file_handle:
                content = file_handle.read(2 * 1024 * 1024).decode(
                    "utf-8", errors="replace"
                )
        except OSError:
            continue
        if HANG_PATTERN.search(content):
            return True
    return False


def _file_manifest(files: list[Path]) -> list[dict[str, object]]:
    manifest = []
    for file_path in files:
        try:
            digest = hashlib.sha256(file_path.read_bytes()).hexdigest()
            manifest.append(
                {
                    "path": str(file_path),
                    "bytes": file_path.stat().st_size,
                    "sha256": digest,
                }
            )
        except OSError as error:
            manifest.append({"path": str(file_path), "error": str(error)})
    return manifest


def classify_outcome(
    step_outcome: str,
    exit_code: int | None,
    report_files: list[Path],
    diagnostic_files: list[Path],
) -> dict[str, object]:
    tests, failed_tests, parse_errors = _junit_counts(report_files)
    reasons = []

    if step_outcome == "cancelled":
        classification = "cancelled"
        reasons.append("The test step was cancelled.")
    elif exit_code in HANG_EXIT_CODES or _contains_process_timeout(diagnostic_files):
        classification = "hung_test"
        reasons.append("The test process exceeded its bounded execution time.")
    elif tests["failures"] + tests["errors"] > 0:
        classification = "test_failure"
        reasons.append("JUnit reported a test failure or error.")
    elif parse_errors:
        classification = "infrastructure_failure"
        reasons.append("One or more JUnit reports could not be parsed.")
    elif step_outcome == "success" and tests["tests"] == 0:
        classification = "missing_results"
        reasons.append("The test step succeeded without reporting any tests.")
    elif step_outcome in {"failure", "skipped", "unknown", ""} and tests["tests"] == 0:
        classification = "setup_failure"
        reasons.append("The test process did not produce a test result.")
    elif step_outcome != "success" or exit_code not in {None, 0}:
        classification = "infrastructure_failure"
        reasons.append("Tests did not fail, but the surrounding test process failed.")
    else:
        classification = "passed"
        reasons.append("The test process and every reported test passed.")

    return {
        "schemaVersion": 1,
        "classification": classification,
        "stepOutcome": step_outcome,
        "exitCode": exit_code,
        "tests": tests,
        "failedTests": failed_tests,
        "reportCount": len(report_files),
        "reports": _file_manifest(report_files),
        "reportParseErrors": parse_errors,
        "diagnostics": _file_manifest(diagnostic_files),
        "reasons": reasons,
    }


def _expand_globs(patterns: list[str]) -> list[Path]:
    return sorted(
        {
            Path(match)
            for pattern in patterns
            for match in glob.glob(pattern, recursive=True)
            if Path(match).is_file()
        },
        key=str,
    )


def _parse_exit_code(value: str) -> int | None:
    return int(value) if value.strip() else None


def _source_sha() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return os.environ.get("GITHUB_SHA", "")


def _summary(result: dict[str, object]) -> str:
    tests = result["tests"]
    context = result.get("context", {})
    return "\n".join(
        [
            "### Test outcome classification",
            "",
            f"- Classification: `{result['classification']}`",
            f"- Source SHA: `{context.get('sourceSha', '')}`",
            f"- Profile/lane: `{context.get('profile', '')}` / `{context.get('lane', '')}`",
            f"- Step outcome: `{result['stepOutcome']}`",
            f"- Exit code: `{result['exitCode']}`",
            f"- JUnit: {tests['tests']} tests, {tests['failures']} failures, "
            f"{tests['errors']} errors, {tests['skipped']} skipped",
            f"- Reports: {result['reportCount']}",
            f"- Diagnostics: {len(result['diagnostics'])}",
            f"- Reason: {result['reasons'][0]}",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--step-outcome", required=True)
    parser.add_argument("--exit-code", default="")
    parser.add_argument("--report-glob", action="append", default=[])
    parser.add_argument("--diagnostic-glob", action="append", default=[])
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary")
    args = parser.parse_args()

    report_files = _expand_globs(args.report_glob)
    diagnostic_files = _expand_globs(args.diagnostic_glob)
    result = classify_outcome(
        args.step_outcome,
        _parse_exit_code(args.exit_code),
        report_files,
        diagnostic_files,
    )
    result["context"] = {
        "sourceSha": _source_sha(),
        "profile": os.environ.get("TEST_PROFILE", ""),
        "lane": os.environ.get("TEST_LANE", ""),
        "runId": os.environ.get("GITHUB_RUN_ID", ""),
        "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    summary = _summary(result)
    summary_path = args.summary or os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a", encoding="utf-8") as summary_file:
            summary_file.write(summary)
    print(summary, end="")

    return int(args.step_outcome == "success" and result["classification"] != "passed")


if __name__ == "__main__":
    raise SystemExit(main())
