"""Build a deterministic Playwright outcome and zero-retry shadow-gate ledger."""

import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

KNOWN_STATUSES = {"expected", "unexpected", "flaky", "skipped"}
HANG_EXIT_CODES = {124}
ARTIFACT_SHARD_PATTERN = re.compile(
    r"(?:playwright|sso)-results-json-(?P<shard>[^/]+)$"
)


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


def _file_manifest(files: list[Path]) -> list[dict[str, object]]:
    manifest = []
    for file_path in files:
        try:
            content = file_path.read_bytes()
            manifest.append(
                {
                    "path": str(file_path),
                    "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
        except OSError as error:
            manifest.append({"path": str(file_path), "error": str(error)})
    return manifest


def _infer_shard(file_path: Path) -> str:
    for part in reversed(file_path.parts):
        match = ARTIFACT_SHARD_PATTERN.match(part)
        if match:
            return match.group("shard")
    return ""


def _normalize_file(file_name: object) -> str:
    normalized = str(file_name or "").replace("\\", "/")
    marker = "playwright/e2e/"
    marker_index = normalized.find(marker)
    return normalized[marker_index:] if marker_index >= 0 else normalized


def _normalize_error(error: object) -> str:
    if isinstance(error, dict):
        value = error.get("message") or error.get("value") or ""
    else:
        value = error or ""
    normalized = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", str(value))
    normalized = re.sub(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
        "<uuid>",
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = re.sub(r"\b\d+(?:\.\d+)?(?:ms|s|m)\b", "<duration>", normalized)
    normalized = re.sub(r"(?<=:)(\d+):(\d+)\b", "<line>:<column>", normalized)
    normalized = re.sub(r"\b(localhost|127\.0\.0\.1):\d+\b", r"\1:<port>", normalized)
    normalized = re.sub(r"(?<![\w])\d{5,}(?![\w])", "<number>", normalized)
    return re.sub(r"\s+", " ", normalized).strip()[:4000]


def _test_record(
    test: dict[str, Any],
    title: str,
    file_name: str,
    report_file: Path,
    shard: str,
) -> dict[str, object]:
    results = test.get("results")
    attempts = results if isinstance(results, list) else []
    first_error = ""
    for attempt in attempts:
        if isinstance(attempt, dict) and attempt.get("error"):
            first_error = _normalize_error(attempt["error"])
            break

    project = str(test.get("projectName") or "unknown-project")
    stable_id = " :: ".join((project, file_name, title))
    return {
        "stableId": stable_id,
        "project": project,
        "file": file_name,
        "title": title,
        "status": str(test.get("status") or "unknown"),
        "attempts": len(attempts),
        "retries": max(0, len(attempts) - 1),
        "firstError": first_error,
        "errorFingerprint": (
            hashlib.sha256(first_error.encode("utf-8")).hexdigest()
            if first_error
            else ""
        ),
        "shard": shard,
        "report": str(report_file),
    }


def _collect_suite_tests(
    suite: dict[str, Any],
    report_file: Path,
    shard: str,
    inherited_file: str = "",
    inherited_titles: tuple[str, ...] = (),
) -> list[dict[str, object]]:
    file_name = _normalize_file(suite.get("file") or inherited_file)
    suite_title = str(suite.get("title") or "").strip()
    if suite_title.replace("\\", "/") in {
        file_name,
        file_name.rsplit("/", 1)[-1],
    }:
        suite_title = ""
    title_prefix = inherited_titles + ((suite_title,) if suite_title else ())
    records = []

    specs = suite.get("specs")
    for spec in specs if isinstance(specs, list) else []:
        if not isinstance(spec, dict):
            continue
        spec_file = _normalize_file(spec.get("file") or file_name)
        spec_title = str(spec.get("title") or "unnamed test").strip()
        title = " › ".join((*title_prefix, spec_title))
        tests = spec.get("tests")
        for test in tests if isinstance(tests, list) else []:
            if isinstance(test, dict):
                records.append(_test_record(test, title, spec_file, report_file, shard))

    child_suites = suite.get("suites")
    for child in child_suites if isinstance(child_suites, list) else []:
        if isinstance(child, dict):
            records.extend(
                _collect_suite_tests(
                    child,
                    report_file,
                    shard,
                    inherited_file=file_name,
                    inherited_titles=title_prefix,
                )
            )
    return records


def _read_reports(
    report_files: list[Path],
) -> tuple[list[dict[str, object]], list[str], list[str]]:
    records = []
    parse_errors = []
    empty_reports = []
    for report_file in report_files:
        try:
            report = json.loads(report_file.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            parse_errors.append(f"{report_file}: {error}")
            continue
        if not isinstance(report, dict):
            parse_errors.append(f"{report_file}: the report root is not an object")
            continue

        report_records = []
        suites = report.get("suites")
        for suite in suites if isinstance(suites, list) else []:
            if isinstance(suite, dict):
                report_records.extend(
                    _collect_suite_tests(suite, report_file, _infer_shard(report_file))
                )
        if not report_records:
            empty_reports.append(str(report_file))
        records.extend(report_records)
    return records, parse_errors, empty_reports


def _read_statuses(
    status_files: list[Path],
) -> tuple[list[dict[str, object]], list[str]]:
    statuses = []
    parse_errors = []
    for status_file in status_files:
        try:
            status = json.loads(status_file.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            parse_errors.append(f"{status_file}: {error}")
            continue
        if not isinstance(status, dict):
            parse_errors.append(f"{status_file}: the status root is not an object")
            continue
        status["_path"] = str(status_file)
        status["shard"] = str(status.get("shard") or _infer_shard(status_file))
        statuses.append(status)
    return statuses, parse_errors


def _expected_shards(explicit: list[str], matrix_json: str) -> tuple[list[str], str]:
    shards = {str(shard) for shard in explicit if str(shard)}
    if not matrix_json.strip():
        return sorted(shards), ""
    try:
        matrix = json.loads(matrix_json)
        if not isinstance(matrix, dict):
            raise ValueError("matrix root is not an object")
        if "include" in matrix:
            includes = matrix["include"]
            if not isinstance(includes, list):
                raise ValueError("include is not an array")
            for entry in includes:
                if not isinstance(entry, dict) or not entry.get("shardId"):
                    raise ValueError("each include entry must contain shardId")
                shards.add(str(entry["shardId"]))
        else:
            shard_indexes = matrix.get("shardIndex", [])
            if not isinstance(shard_indexes, list):
                raise ValueError("shardIndex is not an array")
            shards.update(str(shard) for shard in shard_indexes)
    except (ValueError, json.JSONDecodeError) as error:
        return sorted(shards), str(error)
    return sorted(shards), ""


def _parse_exit_code(value: object) -> int | None:
    try:
        return int(str(value)) if str(value).strip() else None
    except ValueError:
        return None


def _baseline_ids(path: str) -> tuple[set[str], str]:
    if not path:
        return set(), ""
    try:
        baseline = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        return set(), str(error)
    if isinstance(baseline, list):
        return {str(value) for value in baseline}, ""
    if not isinstance(baseline, dict):
        return set(), "baseline root is not an object or array"
    values = baseline.get("stableIds", baseline.get("retryPasses", []))
    if not isinstance(values, list):
        return set(), "baseline stableIds/retryPasses is not an array"
    return {
        str(value.get("stableId") if isinstance(value, dict) else value)
        for value in values
    }, ""


def classify_playwright_outcome(
    report_files: list[Path],
    status_files: list[Path],
    matrix_outcome: str = "",
    expected_shards: list[str] | None = None,
    require_statuses: bool = False,
    retry_baseline_ids: set[str] | None = None,
) -> dict[str, object]:
    records, report_parse_errors, empty_reports = _read_reports(report_files)
    statuses, status_parse_errors = _read_statuses(status_files)
    expected = sorted(set(expected_shards or []))
    baseline_configured = retry_baseline_ids is not None
    baseline_ids = retry_baseline_ids or set()
    infrastructure_issues = []

    infrastructure_issues.extend(
        f"Invalid Playwright report: {error}" for error in report_parse_errors
    )
    infrastructure_issues.extend(
        f"Invalid execution status: {error}" for error in status_parse_errors
    )
    infrastructure_issues.extend(
        f"Playwright report contains zero tests: {path}" for path in empty_reports
    )
    unknown_records = [
        record for record in records if record["status"] not in KNOWN_STATUSES
    ]
    if unknown_records:
        infrastructure_issues.append(
            f"{len(unknown_records)} test(s) reported an unknown status."
        )

    report_shards = {str(record["shard"]) for record in records if record["shard"]}
    status_by_shard = {
        str(status["shard"]): status for status in statuses if status.get("shard")
    }
    failures = [record for record in records if record["status"] == "unexpected"]
    retry_passes = [record for record in records if record["status"] == "flaky"]
    passed = [record for record in records if record["status"] == "expected"]
    skipped = [record for record in records if record["status"] == "skipped"]
    failure_count_by_shard: dict[str, int] = {}
    for failure in failures:
        shard = str(failure["shard"])
        failure_count_by_shard[shard] = failure_count_by_shard.get(shard, 0) + 1

    if expected:
        for shard in expected:
            if shard not in report_shards:
                infrastructure_issues.append(
                    f"Shard {shard} did not produce a usable Playwright report."
                )
            if require_statuses and shard not in status_by_shard:
                infrastructure_issues.append(
                    f"Shard {shard} did not produce execution status."
                )
        for shard in sorted(report_shards - set(expected)):
            infrastructure_issues.append(
                f"Unexpected shard {shard} produced a Playwright report."
            )

    hung_shards = []
    for status in statuses:
        shard = str(status.get("shard") or "unknown")
        steps = status.get("steps")
        steps = steps if isinstance(steps, dict) else {}
        setup_failure = next(
            (
                name
                for name, outcome in steps.items()
                if name != "tests" and outcome in {"failure", "cancelled"}
            ),
            "",
        )
        if setup_failure:
            infrastructure_issues.append(
                f"Shard {shard} failed during {setup_failure} setup."
            )

        exit_code = _parse_exit_code(status.get("exitCode"))
        if exit_code in HANG_EXIT_CODES:
            hung_shards.append(shard)
            continue
        test_outcome = str(steps.get("tests") or "not-run")
        if test_outcome != "success" and not (
            test_outcome == "failure" and failure_count_by_shard.get(shard, 0) > 0
        ):
            infrastructure_issues.append(
                f"Shard {shard} test execution finished with status {test_outcome} "
                "without a reported test failure."
            )

    if matrix_outcome == "cancelled":
        infrastructure_issues.append("The Playwright matrix was cancelled.")
    elif matrix_outcome == "skipped":
        infrastructure_issues.append("The Playwright matrix was unexpectedly skipped.")
    elif matrix_outcome == "failure" and not failures and not infrastructure_issues:
        infrastructure_issues.append(
            "The Playwright matrix failed outside a reported test failure."
        )

    if matrix_outcome == "cancelled":
        classification = "cancelled"
    elif hung_shards:
        classification = "hung_test"
    elif failures:
        classification = "test_failure"
    elif infrastructure_issues:
        classification = "infrastructure_failure"
    elif not records:
        classification = "missing_results"
    elif retry_passes:
        classification = "passed_with_retries"
    else:
        classification = "passed"

    records.sort(key=lambda record: str(record["stableId"]))
    failure_ids = sorted({str(record["stableId"]) for record in failures})
    retry_ids = sorted({str(record["stableId"]) for record in retry_passes})
    skipped_ids = sorted({str(record["stableId"]) for record in skipped})
    new_retry_ids = sorted(set(retry_ids) - baseline_ids) if baseline_configured else []
    unbaselined_retry_ids = retry_ids if not baseline_configured else []
    current_gate_would_fail = classification not in {"passed", "passed_with_retries"}
    shadow_gate_would_fail = current_gate_would_fail or bool(retry_ids)

    return {
        "schemaVersion": 1,
        "classification": classification,
        "matrixOutcome": matrix_outcome,
        "counts": {
            "tests": len(records),
            "passed": len(passed),
            "failed": len(failures),
            "retryPassed": len(retry_passes),
            "skipped": len(skipped),
            "unknown": len(unknown_records),
        },
        "expectedShards": expected,
        "observedReportShards": sorted(report_shards),
        "observedStatusShards": sorted(status_by_shard),
        "hungShards": sorted(set(hung_shards)),
        "infrastructureIssues": infrastructure_issues,
        "failureStableIds": failure_ids,
        "retryPassStableIds": retry_ids,
        "newRetryPassStableIds": new_retry_ids,
        "unbaselinedRetryPassStableIds": unbaselined_retry_ids,
        "skippedStableIds": skipped_ids,
        "failures": failures,
        "retryPasses": retry_passes,
        "skipped": skipped,
        "currentGate": {"wouldFail": current_gate_would_fail},
        "retryBaseline": {
            "configured": baseline_configured,
            "stableIdCount": len(baseline_ids),
        },
        "shadowGate": {
            "policy": "zero-retry-pass",
            "enforcing": False,
            "wouldFail": shadow_gate_would_fail,
            "shadowOnlyFailure": shadow_gate_would_fail and not current_gate_would_fail,
            "retryPassSignatureCount": len(retry_ids),
            "newRetryPassSignatureCount": len(new_retry_ids),
        },
        "reports": _file_manifest(report_files),
        "statuses": _file_manifest(status_files),
        "reportParseErrors": report_parse_errors,
        "statusParseErrors": status_parse_errors,
    }


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
    counts = result["counts"]
    context = result["context"]
    shadow_gate = result["shadowGate"]
    lines = [
        "### Playwright deterministic gate",
        "",
        f"- Classification: `{result['classification']}`",
        f"- Source SHA: `{context['sourceSha']}`",
        f"- Profile: `{context['profile']}`",
        f"- Tests: {counts['tests']} total, {counts['failed']} failed, "
        f"{counts['retryPassed']} passed on retry, {counts['skipped']} skipped",
        f"- Current gate would fail: `{str(result['currentGate']['wouldFail']).lower()}`",
        f"- Shadow zero-retry gate would fail: `{str(shadow_gate['wouldFail']).lower()}`",
        f"- Retry-pass signatures: {shadow_gate['retryPassSignatureCount']}",
        "",
    ]
    if result["retryBaseline"]["configured"]:
        lines.insert(
            -1,
            f"- New retry-pass signatures: {shadow_gate['newRetryPassSignatureCount']}",
        )
    else:
        lines.insert(
            -1, "- Retry baseline: not supplied; signatures are observation-only"
        )
    retry_ids = result["retryPassStableIds"]
    if retry_ids:
        lines.extend(["#### Retry-pass signatures", ""])
        lines.extend(f"- `{stable_id}`" for stable_id in retry_ids[:30])
        if len(retry_ids) > 30:
            lines.append(f"- ... and {len(retry_ids) - 30} more")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report-glob", action="append", default=[])
    parser.add_argument("--status-glob", action="append", default=[])
    parser.add_argument("--matrix-outcome", default="")
    parser.add_argument("--expected-shard", action="append", default=[])
    parser.add_argument("--expected-matrix-json", default="")
    parser.add_argument("--retry-baseline", default="")
    parser.add_argument("--profile", default="")
    parser.add_argument("--source-sha", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary")
    parser.add_argument("--enforce", action="store_true")
    args = parser.parse_args()

    report_files = _expand_globs(args.report_glob)
    status_files = _expand_globs(args.status_glob)
    expected_shards, matrix_error = _expected_shards(
        args.expected_shard, args.expected_matrix_json
    )
    baseline_ids, baseline_error = _baseline_ids(args.retry_baseline)
    result = classify_playwright_outcome(
        report_files,
        status_files,
        matrix_outcome=args.matrix_outcome,
        expected_shards=expected_shards,
        require_statuses=bool(args.status_glob),
        retry_baseline_ids=baseline_ids if args.retry_baseline else None,
    )
    if matrix_error:
        result["infrastructureIssues"].append(
            f"The expected shard matrix was invalid: {matrix_error}"
        )
        result["classification"] = "infrastructure_failure"
        result["currentGate"]["wouldFail"] = True
        result["shadowGate"]["wouldFail"] = True
        result["shadowGate"]["shadowOnlyFailure"] = False
    if baseline_error:
        result["infrastructureIssues"].append(
            f"The retry-pass baseline was invalid: {baseline_error}"
        )
        result["classification"] = "infrastructure_failure"
        result["currentGate"]["wouldFail"] = True
        result["shadowGate"]["wouldFail"] = True
        result["shadowGate"]["shadowOnlyFailure"] = False

    result["shadowGate"]["enforcing"] = args.enforce
    result["context"] = {
        "sourceSha": args.source_sha
        or os.environ.get("SOURCE_SHA", "")
        or _source_sha(),
        "profile": args.profile or os.environ.get("TEST_PROFILE", ""),
        "runId": os.environ.get("GITHUB_RUN_ID", ""),
        "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
        "eventName": os.environ.get("GITHUB_EVENT_NAME", ""),
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
    return int(args.enforce and result["shadowGate"]["wouldFail"])


if __name__ == "__main__":
    raise SystemExit(main())
