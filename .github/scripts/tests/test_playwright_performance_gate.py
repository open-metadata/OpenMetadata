"""Tests for the Playwright performance-gate script.

Focus: the 25-minute execution ceiling introduced with PR #30689's wrapper
bump, and the shard-level attribution added so gate failures name the
offending shards instead of surfacing a generic "1 CI/reporting failure(s)"
banner (run 30736786802 was the trigger)."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path


SCRIPTS = Path(__file__).parents[1]


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_execution_target_matches_wrapper_ceiling():
    # Wrapper is 25m (playwright-postgresql-e2e.yml:1092). The gate must
    # match — the 21m gate was pre-PR-#30689 and marked healthy shards as
    # failures. If someone changes one without the other, this test fires.
    evaluator = load_script("evaluate_playwright_performance")
    detail = evaluator.BLOCKING_TARGET_DETAILS["executionAtMostTwentyFiveMinutes"]

    assert detail["threshold"] == 1500
    assert detail["phase_field"] == "executionSeconds"


def test_offending_shards_lists_only_phases_over_threshold():
    evaluator = load_script("evaluate_playwright_performance")
    phases = [
        {"shardId": "chromium-01", "lane": "chromium", "executionSeconds": 800},
        {"shardId": "chromium-02", "lane": "chromium", "executionSeconds": 1620},
        {"shardId": "chromium-03", "lane": "chromium", "executionSeconds": 1500},
        {"shardId": "chromium-04", "lane": "chromium", "executionSeconds": 1501},
    ]

    offending = evaluator.offending_shards(
        phases, "executionAtMostTwentyFiveMinutes"
    )

    # 1500 is inclusive-pass (`<= 1500`); 1501 and 1620 are over.
    assert [item["shardId"] for item in offending] == [
        "chromium-02",
        "chromium-04",
    ]
    assert offending[0]["value"] == 1620


def test_describe_failed_target_names_top_offenders():
    evaluator = load_script("evaluate_playwright_performance")
    phases = [
        {"shardId": f"chromium-{i:02d}", "lane": "chromium", "executionSeconds": 1600 + i}
        for i in range(1, 8)
    ]

    message = evaluator.describe_failed_target(
        "executionAtMostTwentyFiveMinutes", phases
    )

    # Names the target label, the threshold, the shard count, and the top-5
    # offenders — the piece the merge-queue error message previously lacked.
    assert "Maximum shard execution" in message
    assert "target ≤ 1500 s" in message
    assert "exceeded on 7 shard(s)" in message
    assert "chromium-07 1607 s" in message
    assert "(+2 more)" in message


def test_enforce_exits_with_detailed_message(tmp_path):
    # End-to-end: run the script with --enforce against synthetic phase files
    # that trip the gate. Confirms the exit message carries the per-shard
    # detail that the summary renderer now surfaces.
    timings = tmp_path / "timings.json"
    requests = tmp_path / "requests.json"
    phase_a = tmp_path / "phase-chromium-01.json"
    phase_b = tmp_path / "phase-chromium-02.json"
    output = tmp_path / "performance.json"

    timings.write_text(json.dumps({"tests": [], "lifecycleTests": []}))
    requests.write_text(json.dumps({}))
    # Below the wrapper (would pass) and above (must trip the gate).
    phase_a.write_text(
        json.dumps(
            {"shardId": "chromium-01", "lane": "chromium",
             "environmentSeconds": 10, "executionSeconds": 1200,
             "elapsedBeforeUploadSeconds": 1250}
        )
    )
    phase_b.write_text(
        json.dumps(
            {"shardId": "chromium-02", "lane": "chromium",
             "environmentSeconds": 10, "executionSeconds": 1600,
             "elapsedBeforeUploadSeconds": 1650}
        )
    )

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "evaluate_playwright_performance.py"),
            "--timing-glob", str(tmp_path / "timings.json"),
            "--request-glob", str(tmp_path / "requests.json"),
            "--phase-glob", str(tmp_path / "phase-*.json"),
            "--mode", "full",
            "--output", str(output),
            "--enforce",
        ],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1, result.stdout + result.stderr
    combined = result.stdout + result.stderr
    assert "Blocking Playwright performance targets not met" in combined
    assert "chromium-02" in combined
    assert "1600 s" in combined

    payload = json.loads(output.read_text())
    detail = payload["failedBlockingTargetDetails"][
        "executionAtMostTwentyFiveMinutes"
    ]
    assert detail["label"] == "Maximum shard execution"
    assert detail["threshold"] == 1500
    assert detail["offendingShards"] == [
        {"shardId": "chromium-02", "lane": "chromium", "value": 1600}
    ]


def test_failed_details_absent_when_phase_targets_pass(tmp_path):
    # Even when non-phase targets fail (empty requests/timings trip a few of
    # them), only the phase-attributable targets contribute entries to
    # `failedBlockingTargetDetails`. This isolates the shard-attribution
    # payload to the targets that carry per-shard evidence.
    timings = tmp_path / "timings.json"
    requests = tmp_path / "requests.json"
    phase = tmp_path / "phase-chromium-01.json"
    output = tmp_path / "performance.json"

    timings.write_text(json.dumps({"tests": [], "lifecycleTests": []}))
    requests.write_text(json.dumps({}))
    phase.write_text(
        json.dumps(
            {"shardId": "chromium-01", "lane": "chromium",
             "environmentSeconds": 10, "executionSeconds": 1200,
             "elapsedBeforeUploadSeconds": 1250}
        )
    )

    subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "evaluate_playwright_performance.py"),
            "--timing-glob", str(tmp_path / "timings.json"),
            "--request-glob", str(tmp_path / "requests.json"),
            "--phase-glob", str(tmp_path / "phase-*.json"),
            "--mode", "full",
            "--output", str(output),
        ],
        capture_output=True,
        text=True,
    )

    payload = json.loads(output.read_text())
    # All three phase-attributable targets are within budget for this fixture.
    for target in (
        "environmentAtMostFiveMinutes",
        "executionAtMostTwentyFiveMinutes",
        "shardsAtMostThirtyMinutesBeforeUpload",
    ):
        assert payload["blockingTargets"][target] is True
    assert payload["failedBlockingTargetDetails"] == {}
