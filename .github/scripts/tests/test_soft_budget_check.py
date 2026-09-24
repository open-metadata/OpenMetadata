"""Tests for the soft-budget CI helper."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / ".github" / "scripts" / "soft_budget_check.py"


# --- build_payload -----------------------------------------------------------

# Import via importlib to keep the tests self-contained even if the scripts
# folder is not a package on sys.path.
import importlib.util

spec = importlib.util.spec_from_file_location("soft_budget_check", SCRIPT)
sbc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sbc)  # type: ignore[union-attr]


def _payload(**overrides):
    defaults = dict(
        job="playwright-ci shard 3",
        started_at=1_000_000,
        now=1_000_000 + 20 * 60,
        budget_minutes=19,
        channel="C0C008ZAK0V",
        run_url="https://github.com/o/r/actions/runs/999",
        commit_url="https://github.com/o/r/commit/deadbeef",
        commit_sha="deadbeefcafebabe",
        event_name="pull_request",
        ref="refs/pull/42/merge",
        pr_number="42",
    )
    defaults.update(overrides)
    return sbc.build_payload(**defaults)


def test_under_budget_returns_none():
    assert _payload(now=1_000_000 + 5 * 60) is None


def test_exactly_at_budget_is_not_over():
    # 19m budget, 19m observed → equal → not over.
    assert _payload(now=1_000_000 + 19 * 60) is None


def test_over_by_one_second_reports():
    result = _payload(now=1_000_000 + 19 * 60 + 1)
    assert result is not None
    assert result["channel"] == "C0C008ZAK0V"
    assert "budget *19m*" in result["text"]


def test_negative_delta_is_clamped():
    # Clock skew: started_at reported after now. Duration clamps to 0, well
    # under budget, so no payload.
    assert _payload(started_at=2_000_000, now=1_000_000) is None


def test_zero_duration_under_any_positive_budget():
    assert _payload(started_at=1_000_000, now=1_000_000, budget_minutes=1) is None


def test_payload_uses_pr_number_when_present():
    result = _payload(now=1_000_000 + 30 * 60)
    assert "PR #42" in result["text"]


def test_payload_falls_back_to_ref_without_pr_number():
    result = _payload(now=1_000_000 + 30 * 60, pr_number="", ref="refs/heads/main")
    assert "PR #" not in result["text"]
    assert "refs/heads/main" in result["text"]


def test_payload_falls_back_to_event_name_without_pr_or_ref():
    result = _payload(
        now=1_000_000 + 30 * 60, pr_number="", ref="", event_name="schedule"
    )
    assert "schedule" in result["text"]


def test_short_sha_in_link():
    result = _payload(now=1_000_000 + 30 * 60)
    # Only the leading 7 characters land in the mrkdwn link body.
    assert "|deadbee>" in result["text"]


def test_human_duration_zero():
    assert sbc._human_duration(0) == "0m 00s"


def test_human_duration_seconds_only():
    assert sbc._human_duration(75) == "1m 15s"


def test_human_duration_hours():
    assert sbc._human_duration(3 * 3600 + 5 * 60) == "3h 05m"


def test_human_duration_negative_clamps():
    assert sbc._human_duration(-42) == "0m 00s"


# --- CLI ---------------------------------------------------------------------


def _run_cli(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_over_budget_writes_file(tmp_path: Path):
    out = tmp_path / "slack.json"
    result = _run_cli(
        "--job", "unit-test-job",
        "--started-at", "1000000",
        "--now", str(1_000_000 + 45 * 60),
        "--budget-minutes", "10",
        "--run-url", "https://example.test/run",
        "--commit-url", "https://example.test/commit/abc",
        "--commit-sha", "abcdef1234567",
        "--event-name", "schedule",
        "--ref", "refs/heads/main",
        "--output", str(out),
    )
    assert result.returncode == 0, result.stderr
    assert out.exists()
    payload = json.loads(out.read_text())
    assert payload["channel"] == "C0C008ZAK0V"
    assert "unit-test-job" in payload["text"]
    assert "budget *10m*" in payload["text"]


def test_cli_under_budget_writes_no_file(tmp_path: Path):
    out = tmp_path / "slack.json"
    result = _run_cli(
        "--job", "unit-test-job",
        "--started-at", "1000000",
        "--now", str(1_000_000 + 60),
        "--budget-minutes", "10",
        "--output", str(out),
    )
    assert result.returncode == 0, result.stderr
    assert not out.exists()


def test_cli_under_budget_removes_stale_file(tmp_path: Path):
    # A prior over-budget invocation on the same runner should not leak into
    # the current step's decision.
    out = tmp_path / "slack.json"
    out.write_text('{"stale": true}')

    result = _run_cli(
        "--job", "job",
        "--started-at", "1000000",
        "--now", str(1_000_000 + 60),
        "--budget-minutes", "10",
        "--output", str(out),
    )
    assert result.returncode == 0, result.stderr
    assert not out.exists()


def test_cli_creates_parent_dirs(tmp_path: Path):
    out = tmp_path / "nested" / "dirs" / "slack.json"
    result = _run_cli(
        "--job", "job",
        "--started-at", "1000000",
        "--now", str(1_000_000 + 3600),
        "--budget-minutes", "10",
        "--output", str(out),
    )
    assert result.returncode == 0, result.stderr
    assert out.exists()


@pytest.mark.parametrize("bad_arg", ["--started-at", "--budget-minutes"])
def test_cli_rejects_non_integer_ints(tmp_path: Path, bad_arg: str):
    args = [
        "--job", "job",
        "--started-at", "1000000",
        "--budget-minutes", "10",
        "--output", str(tmp_path / "x.json"),
    ]
    # Replace the value after the parameterised flag with garbage.
    idx = args.index(bad_arg)
    args[idx + 1] = "not-a-number"
    result = _run_cli(*args)
    assert result.returncode != 0
