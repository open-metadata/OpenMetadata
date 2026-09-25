"""Exercise artifact recovery without contacting GitHub or rerunning tests."""

import json
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "normalize_playwright_artifacts.cjs"


def write_report(
    root, suffix="", *, status="expected", head="tested-sha", attempt="1", run="10"
):
    directory = root / f"playwright-results-json-chromium-01{suffix}"
    directory.mkdir(parents=True)
    (directory / "results.json").write_text(
        json.dumps({"suites": [{"specs": [{"tests": [{"status": status}]}]}]})
    )
    (directory / "ci-status.json").write_text(
        json.dumps(
            {
                "shard": "chromium-01",
                "headSha": head,
                "runId": run,
                "runAttempt": attempt,
                "steps": {"tests": "success"},
            }
        )
    )
    return directory


def normalize(root):
    return subprocess.run(
        ["node", str(SCRIPT), str(root), "tested-sha"],
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize("suffixes", [("-retry",), ("", "-retry")])
def test_transport_retry_is_one_execution(tmp_path, suffixes):
    for suffix in suffixes:
        write_report(tmp_path, suffix)
    result = normalize(tmp_path)
    assert result.returncode == 0, result.stderr
    assert [p.name for p in tmp_path.iterdir()] == [
        "playwright-results-json-chromium-01"
    ]


def test_retry_cannot_replace_failed_test_with_success(tmp_path):
    write_report(tmp_path, status="unexpected")
    write_report(tmp_path, "-retry")
    result = normalize(tmp_path)
    assert result.returncode != 0
    assert "Conflicting" in result.stderr


@pytest.mark.parametrize("fault", ["invalid", "missing", "wrong-commit", "wrong-shard"])
def test_invalid_execution_evidence_is_rejected(tmp_path, fault):
    directory = write_report(tmp_path)
    if fault == "invalid":
        (directory / "results.json").write_text("{interrupted")
    elif fault == "missing":
        (directory / "ci-status.json").unlink()
    else:
        status = json.loads((directory / "ci-status.json").read_text())
        status["headSha" if fault == "wrong-commit" else "shard"] = "other"
        (directory / "ci-status.json").write_text(json.dumps(status))
    result = normalize(tmp_path)
    assert result.returncode != 0
    if fault == "missing":
        assert "Missing execution evidence: ci-status.json" in result.stderr


@pytest.mark.parametrize(
    "key,value",
    [
        ("runId", None),
        ("runId", ""),
        ("runId", "invalid"),
        ("runAttempt", None),
        ("runAttempt", ""),
        ("runAttempt", 0),
        ("runAttempt", -1),
        ("runAttempt", 1.5),
        ("runAttempt", "invalid"),
    ],
)
def test_missing_or_invalid_workflow_identity_is_rejected(tmp_path, key, value):
    directory = write_report(tmp_path)
    status_file = directory / "ci-status.json"
    status = json.loads(status_file.read_text())
    if value is None:
        status.pop(key)
    else:
        status[key] = value
    status_file.write_text(json.dumps(status))
    result = normalize(tmp_path)
    assert result.returncode != 0
    assert "Invalid workflow execution identity" in result.stderr


def test_real_failure_survives_identical_transport_retry(tmp_path):
    write_report(tmp_path, status="unexpected")
    write_report(tmp_path, "-retry", status="unexpected")
    assert normalize(tmp_path).returncode == 0
    report = json.loads(next(tmp_path.glob("*/results.json")).read_text())
    assert report["suites"][0]["specs"][0]["tests"][0]["status"] == "unexpected"


def test_empty_download_is_not_verified_evidence(tmp_path):
    result = normalize(tmp_path)
    assert result.returncode != 0
    assert "No execution artifacts" in result.stderr


@pytest.mark.parametrize("newest_suffix", ["", "-retry"])
def test_workflow_rerun_uses_newest_execution_not_stale_transport_fallback(
    tmp_path, newest_suffix
):
    write_report(tmp_path, newest_suffix, attempt="2")
    write_report(
        tmp_path,
        "-retry" if newest_suffix == "" else "",
        status="unexpected",
        attempt="1",
    )
    result = normalize(tmp_path)
    assert result.returncode == 0, result.stderr
    directory = tmp_path / "playwright-results-json-chromium-01"
    assert json.loads((directory / "ci-status.json").read_text())["runAttempt"] == "2"


def test_different_workflow_runs_cannot_be_combined(tmp_path):
    write_report(tmp_path)
    write_report(tmp_path, "-retry", run="other", attempt="2")
    assert normalize(tmp_path).returncode != 0
