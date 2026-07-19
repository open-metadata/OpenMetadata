import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).with_name("classify_test_outcome.py")
SPEC = importlib.util.spec_from_file_location("classify_test_outcome", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
CLASSIFIER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = CLASSIFIER
SPEC.loader.exec_module(CLASSIFIER)


def write_report(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    return path


def test_assertion_failure_is_a_test_failure(tmp_path: Path) -> None:
    report = write_report(
        tmp_path / "TEST-assertion.xml",
        '<testsuite tests="1" failures="1" errors="0" skipped="0">'
        '<testcase classname="ForcedIT" name="forced assertion">'
        '<failure message="expected true"/></testcase>'
        "</testsuite>",
    )
    diagnostic = write_report(tmp_path / "environment.txt", "runner environment")

    result = CLASSIFIER.classify_outcome("failure", 1, [report], [diagnostic])

    assert result["classification"] == "test_failure"
    assert result["tests"] == {"tests": 1, "failures": 1, "errors": 0, "skipped": 0}
    assert result["failedTests"][0]["id"] == "ForcedIT#forced assertion"
    assert result["reports"][0]["sha256"]
    assert result["diagnostics"][0]["sha256"]


def test_setup_failure_has_no_test_result(tmp_path: Path) -> None:
    diagnostic = write_report(tmp_path / "setup.log", "container failed health check")

    result = CLASSIFIER.classify_outcome("skipped", None, [], [diagnostic])

    assert result["classification"] == "setup_failure"
    assert result["reportCount"] == 0
    assert len(result["diagnostics"]) == 1
    assert result["diagnostics"][0]["sha256"]


def test_hung_process_is_distinct_from_setup_failure(tmp_path: Path) -> None:
    try:
        subprocess.run(
            [sys.executable, "-c", "import time; time.sleep(10)"],
            check=False,
            timeout=0.01,
        )
    except subprocess.TimeoutExpired as error:
        diagnostic = write_report(tmp_path / "process-timeout.txt", str(error))
    else:
        raise AssertionError("The forced hung process unexpectedly completed")

    result = CLASSIFIER.classify_outcome("failure", 124, [], [diagnostic])

    assert result["classification"] == "hung_test"
    assert result["exitCode"] == 124
    assert result["diagnostics"][0]["sha256"]


def test_failsafe_fork_timeout_is_a_hung_test(tmp_path: Path) -> None:
    diagnostic = write_report(
        tmp_path / "failsafe.dumpstream", "There was a timeout in the fork"
    )

    result = CLASSIFIER.classify_outcome("failure", 1, [], [diagnostic])

    assert result["classification"] == "hung_test"
    assert result["diagnostics"][0]["sha256"]


def test_passing_report_is_passed(tmp_path: Path) -> None:
    report = write_report(
        tmp_path / "TEST-pass.xml",
        '<testsuite tests="2" failures="0" errors="0" skipped="1">'
        '<testcase name="passes"/><testcase name="skips"><skipped/></testcase>'
        "</testsuite>",
    )

    result = CLASSIFIER.classify_outcome("success", 0, [report], [])

    assert result["classification"] == "passed"
    assert result["tests"]["tests"] == 2
    assert result["tests"]["skipped"] == 1


def test_timeout_configuration_does_not_mark_successful_run_as_hung(
    tmp_path: Path,
) -> None:
    report = write_report(
        tmp_path / "TEST-pass.xml",
        '<testsuite tests="1" failures="0" errors="0" skipped="0">'
        '<testcase name="passes"/></testsuite>',
    )
    diagnostic = write_report(
        tmp_path / "maven.log",
        "Redis cache provider initialized (commandTimeoutMs=1000)",
    )

    result = CLASSIFIER.classify_outcome("success", 0, [report], [diagnostic])

    assert result["classification"] == "passed"


def test_success_without_reports_fails_closed() -> None:
    result = CLASSIFIER.classify_outcome("success", 0, [], [])

    assert result["classification"] == "missing_results"


def test_malformed_report_is_infrastructure_failure(tmp_path: Path) -> None:
    report = write_report(tmp_path / "TEST-broken.xml", "<testsuite>")

    result = CLASSIFIER.classify_outcome("failure", 1, [report], [])

    assert result["classification"] == "infrastructure_failure"
    assert len(result["reportParseErrors"]) == 1


def test_cli_writes_machine_readable_outcome_and_summary(tmp_path: Path) -> None:
    report = write_report(
        tmp_path / "TEST-pass.xml",
        '<testsuite tests="1" failures="0" errors="0" skipped="0">'
        '<testcase classname="PassingIT" name="passes"/>'
        "</testsuite>",
    )
    diagnostic = write_report(tmp_path / "environment.txt", "runner environment")
    output = tmp_path / "outcome.json"
    summary = tmp_path / "summary.md"
    environment = os.environ | {
        "TEST_PROFILE": "forced-profile",
        "TEST_LANE": "parallel",
    }

    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--step-outcome",
            "success",
            "--exit-code",
            "0",
            "--report-glob",
            str(report),
            "--diagnostic-glob",
            str(diagnostic),
            "--output",
            str(output),
            "--summary",
            str(summary),
        ],
        check=False,
        capture_output=True,
        env=environment,
        text=True,
    )

    result = json.loads(output.read_text(encoding="utf-8"))
    assert completed.returncode == 0
    assert result["classification"] == "passed"
    assert result["context"]["profile"] == "forced-profile"
    assert result["context"]["lane"] == "parallel"
    assert result["reports"][0]["sha256"]
    assert result["diagnostics"][0]["sha256"]
    assert "Classification: `passed`" in summary.read_text(encoding="utf-8")


def test_cli_fails_closed_when_a_successful_step_has_no_results(tmp_path: Path) -> None:
    output = tmp_path / "outcome.json"

    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_PATH),
            "--step-outcome",
            "success",
            "--exit-code",
            "0",
            "--output",
            str(output),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    result = json.loads(output.read_text(encoding="utf-8"))
    assert completed.returncode == 1
    assert result["classification"] == "missing_results"
