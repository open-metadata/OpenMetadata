import importlib.util
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).with_name("classify_playwright_outcome.py")
SPEC = importlib.util.spec_from_file_location(
    "classify_playwright_outcome", SCRIPT_PATH
)
assert SPEC is not None and SPEC.loader is not None
CLASSIFIER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CLASSIFIER
SPEC.loader.exec_module(CLASSIFIER)


def write_json(path: Path, value: object) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def report(
    status: str, results: list[dict[str, object]] | None = None
) -> dict[str, object]:
    return {
        "suites": [
            {
                "title": "suite",
                "file": "/workspace/playwright/e2e/example.spec.ts",
                "specs": [
                    {
                        "title": "does work",
                        "tests": [
                            {
                                "projectName": "chromium",
                                "status": status,
                                "results": results or [{}],
                            }
                        ],
                    }
                ],
            }
        ]
    }


def status(
    shard: str, tests: str = "success", exit_code: int | None = 0
) -> dict[str, object]:
    return {
        "shard": shard,
        "exitCode": exit_code,
        "steps": {
            "checkout": "success",
            "setupEnvironment": "success",
            "tests": tests,
        },
    }


def test_passing_report_passes_both_gates(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "playwright-results-json-1" / "results.json", report("expected")
    )
    status_file = write_json(
        tmp_path / "playwright-results-json-1" / "ci-status.json", status("1")
    )

    result = CLASSIFIER.classify_playwright_outcome(
        [report_file], [status_file], "success", ["1"], True
    )

    assert result["classification"] == "passed"
    assert result["currentGate"]["wouldFail"] is False
    assert result["shadowGate"]["wouldFail"] is False
    assert result["reports"][0]["sha256"]
    assert result["statuses"][0]["sha256"]


def test_retry_pass_has_stable_signature_and_only_fails_shadow_gate(
    tmp_path: Path,
) -> None:
    report_file = write_json(
        tmp_path / "playwright-results-json-2" / "results.json",
        report(
            "flaky",
            [
                {
                    "error": {
                        "message": "\u001b[31mTimed out after 90000ms for entity 123456 "
                        "and UUID 123e4567-e89b-12d3-a456-426614174000\u001b[0m"
                    }
                },
                {},
            ],
        ),
    )

    result = CLASSIFIER.classify_playwright_outcome([report_file], [], "success")

    assert result["classification"] == "passed_with_retries"
    assert result["currentGate"]["wouldFail"] is False
    assert result["shadowGate"]["wouldFail"] is True
    assert result["shadowGate"]["shadowOnlyFailure"] is True
    assert result["retryBaseline"]["configured"] is False
    assert result["newRetryPassStableIds"] == []
    assert result["unbaselinedRetryPassStableIds"] == result["retryPassStableIds"]
    assert result["retryPassStableIds"] == [
        "chromium :: playwright/e2e/example.spec.ts :: suite › does work"
    ]
    assert result["retryPasses"][0]["attempts"] == 2
    assert "<number>" in result["retryPasses"][0]["firstError"]
    assert "<uuid>" in result["retryPasses"][0]["firstError"]
    assert "<duration>" in result["retryPasses"][0]["firstError"]
    assert "\u001b" not in result["retryPasses"][0]["firstError"]
    assert result["retryPasses"][0]["errorFingerprint"]


def test_file_root_suite_title_is_not_duplicated(tmp_path: Path) -> None:
    report_body = report("expected")
    report_body["suites"][0]["title"] = "playwright/e2e/example.spec.ts"
    report_file = write_json(tmp_path / "results.json", report_body)

    records, parse_errors, empty_reports = CLASSIFIER._read_reports([report_file])

    assert parse_errors == []
    assert empty_reports == []
    assert records[0]["stableId"] == (
        "chromium :: playwright/e2e/example.spec.ts :: does work"
    )


def test_assertion_failure_is_a_test_failure(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "results.json",
        report("unexpected", [{"error": {"message": "expected true"}}]),
    )

    result = CLASSIFIER.classify_playwright_outcome([report_file], [], "failure")

    assert result["classification"] == "test_failure"
    assert result["counts"]["failed"] == 1
    assert result["currentGate"]["wouldFail"] is True


def test_setup_failure_without_report_is_infrastructure_failure(tmp_path: Path) -> None:
    status_file = write_json(
        tmp_path / "playwright-results-json-1" / "ci-status.json",
        {
            "shard": "1",
            "steps": {"setupEnvironment": "failure", "tests": "skipped"},
        },
    )

    result = CLASSIFIER.classify_playwright_outcome(
        [], [status_file], "failure", ["1"], True
    )

    assert result["classification"] == "infrastructure_failure"
    assert any("setupEnvironment" in issue for issue in result["infrastructureIssues"])


def test_success_without_report_is_missing_results() -> None:
    result = CLASSIFIER.classify_playwright_outcome([], [], "success")

    assert result["classification"] == "missing_results"
    assert result["currentGate"]["wouldFail"] is True


def test_timeout_exit_code_is_a_hung_test(tmp_path: Path) -> None:
    status_file = write_json(
        tmp_path / "playwright-results-json-1" / "ci-status.json",
        status("1", tests="failure", exit_code=124),
    )

    result = CLASSIFIER.classify_playwright_outcome(
        [], [status_file], "failure", ["1"], True
    )

    assert result["classification"] == "hung_test"
    assert result["hungShards"] == ["1"]


def test_missing_expected_shard_fails_closed(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "playwright-results-json-1" / "results.json", report("expected")
    )

    result = CLASSIFIER.classify_playwright_outcome(
        [report_file], [], "success", ["1", "2"]
    )

    assert result["classification"] == "infrastructure_failure"
    assert any("Shard 2" in issue for issue in result["infrastructureIssues"])


def test_baseline_distinguishes_new_retry_passes(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "results.json",
        report("flaky", [{"error": {"message": "first attempt"}}, {}]),
    )
    stable_id = "chromium :: playwright/e2e/example.spec.ts :: suite › does work"

    result = CLASSIFIER.classify_playwright_outcome(
        [report_file], [], "success", retry_baseline_ids={stable_id}
    )

    assert result["retryPassStableIds"] == [stable_id]
    assert result["newRetryPassStableIds"] == []
    assert result["retryBaseline"] == {"configured": True, "stableIdCount": 1}
    assert result["unbaselinedRetryPassStableIds"] == []


def test_configured_baseline_reports_a_new_retry_signature(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "results.json",
        report("flaky", [{"error": {"message": "first attempt"}}, {}]),
    )

    result = CLASSIFIER.classify_playwright_outcome(
        [report_file], [], "success", retry_baseline_ids={"different stable id"}
    )

    assert result["newRetryPassStableIds"] == result["retryPassStableIds"]
    assert result["shadowGate"]["newRetryPassSignatureCount"] == 1


def test_cli_shadow_mode_writes_ledger_but_does_not_fail(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "results.json",
        report("flaky", [{"error": {"message": "first attempt"}}, {}]),
    )
    output = tmp_path / "ledger.json"
    summary = tmp_path / "summary.md"

    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--report-glob",
            str(report_file),
            "--matrix-outcome",
            "success",
            "--profile",
            "postgresql-pr",
            "--source-sha",
            "abc123",
            "--output",
            str(output),
            "--summary",
            str(summary),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    ledger = json.loads(output.read_text(encoding="utf-8"))
    assert completed.returncode == 0
    assert ledger["shadowGate"]["wouldFail"] is True
    assert ledger["shadowGate"]["enforcing"] is False
    assert ledger["retryBaseline"]["configured"] is False
    assert ledger["context"]["sourceSha"] == "abc123"
    assert "Shadow zero-retry gate would fail: `true`" in summary.read_text(
        encoding="utf-8"
    )


def test_cli_enforcement_fails_on_retry_pass(tmp_path: Path) -> None:
    report_file = write_json(
        tmp_path / "results.json",
        report("flaky", [{"error": {"message": "first attempt"}}, {}]),
    )

    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--report-glob",
            str(report_file),
            "--output",
            str(tmp_path / "ledger.json"),
            "--enforce",
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 1
