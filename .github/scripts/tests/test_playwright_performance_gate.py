"""Tests for the Playwright performance-budget script.

Focus: timing/flake targets are BUDGET SIGNALS, not gates. A run where every
test passed must never exit non-zero because a shard ran long — that ejected
green PRs from the merge queue (run 32500973433: 0 test failures, one wedged
retry teardown pushed chromium-12 past the old blocking ceiling). Breaches
are reported in the payload (`failedBudgetTargetDetails`) and stdout for the
workflow's budget-signal step to surface."""

from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path


SCRIPTS = Path(__file__).parents[1]
WORKFLOWS = SCRIPTS.parent / "workflows"


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_execution_budget_stays_below_hang_protection_wrapper():
    # The 1500 s execution target is the BUDGET the planner packs against;
    # the `timeout … Nm` wrapper in playwright-e2e-reusable.yml is HANG
    # PROTECTION and must sit well above it — at parity (the old 25m/1500s
    # pairing) the wrapper killed slow-but-green shards mid-report and
    # destroyed the results artifact (run 32500973433). If someone tightens
    # the wrapper back toward the budget, this test fires.
    evaluator = load_script("evaluate_playwright_performance")
    budget = evaluator.BUDGET_TARGET_DETAILS["executionAtMostTwentyFiveMinutes"]
    assert budget["threshold"] == 1500
    assert budget["phase_field"] == "executionSeconds"

    reusable = (WORKFLOWS / "playwright-e2e-reusable.yml").read_text()
    match = re.search(
        r"timeout --signal=TERM --kill-after=30s (\d+)m\s*\\\s*\n\s*npx playwright test",
        reusable,
    )
    assert match, "hang-protection wrapper on the playwright test step not found"
    wrapper_seconds = int(match.group(1)) * 60
    assert wrapper_seconds - budget["threshold"] >= 240, (
        f"wrapper ({wrapper_seconds}s) must leave >= 4 min of headroom above "
        f"the execution budget ({budget['threshold']}s); a shard between "
        "budget and wrapper should breach the budget signal, not be killed"
    )


def test_timing_targets_are_budget_not_blocking():
    # Every timing/flake target belongs to the budget class; the blocking
    # class is reserved for corrupt-results style states and must be empty
    # for a normal target set — otherwise budget breaches eject PRs again.
    evaluator = load_script("evaluate_playwright_performance")
    targets = {
        "environmentAtMostFiveMinutes": False,
        "executionAtMostTwentyFiveMinutes": False,
        "shardsAtMostThirtyMinutesBeforeUpload": True,
        "commonShardSkewAtMostFifteenPercent": True,
        "flakyRateAtMostPointFivePercent": False,
        "retryWorkerTimeAtMostTwoPercent": True,
        "requestsPerAttemptBelowTwoHundred": True,
        "staticRequestsPerAppBootBelowOneHundred": True,
        "atMostOneAppBootPerUIScenario": True,
        "appBootMeasurementIntegrity": True,
    }

    blocking, budget, convergence = evaluator.classify_targets(targets)

    assert blocking == {}
    assert budget["executionAtMostTwentyFiveMinutes"] is False
    assert budget["flakyRateAtMostPointFivePercent"] is False
    assert convergence["commonShardSkewAtMostFifteenPercent"] is True


def test_summary_workflow_does_not_enforce():
    # The caller must not pass --enforce: with the blocking set empty it is
    # inert, but reintroducing it alongside a reclassification would resurrect
    # the eject-green-PRs failure mode. Guard the workflow text directly
    # (comments may mention the flag; executable lines may not).
    caller = (WORKFLOWS / "playwright-postgresql-e2e.yml").read_text()
    executable_lines = [
        line for line in caller.splitlines()
        if "--enforce" in line and not line.lstrip().startswith("#")
    ]
    assert executable_lines == [], (
        "playwright-postgresql-e2e.yml must not pass --enforce to "
        f"evaluate_playwright_performance.py: {executable_lines}"
    )


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
    # offenders — what the budget annotation and tracked issue surface.
    assert "Maximum shard execution" in message
    assert "target ≤ 1500 s" in message
    assert "exceeded on 7 shard(s)" in message
    assert "chromium-07 1607 s" in message
    assert "(+2 more)" in message


def test_budget_breach_exits_zero_with_detailed_payload(tmp_path):
    # End-to-end: an over-budget shard must NOT fail the script (even with
    # --enforce), but must land in failedBudgetTargetDetails and print a
    # BUDGET BREACH line for the raw log.
    timings = tmp_path / "timings.json"
    requests = tmp_path / "requests.json"
    phase_a = tmp_path / "phase-chromium-01.json"
    phase_b = tmp_path / "phase-chromium-02.json"
    output = tmp_path / "performance.json"

    timings.write_text(json.dumps({"tests": [], "lifecycleTests": []}))
    requests.write_text(json.dumps({}))
    # Below the budget (passes) and above (must surface as a breach).
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

    assert result.returncode == 0, result.stdout + result.stderr
    combined = result.stdout + result.stderr
    assert "BUDGET BREACH" in combined
    assert "chromium-02" in combined
    assert "1600 s" in combined

    payload = json.loads(output.read_text())
    assert payload["blockingTargetsMet"] is True
    assert payload["budgetTargetsMet"] is False
    assert payload["failedBlockingTargetDetails"] == {}
    detail = payload["failedBudgetTargetDetails"][
        "executionAtMostTwentyFiveMinutes"
    ]
    assert detail["label"] == "Maximum shard execution"
    assert detail["threshold"] == 1500
    assert detail["offendingShards"] == [
        {"shardId": "chromium-02", "lane": "chromium", "value": 1600}
    ]


def test_failed_details_absent_when_phase_targets_pass(tmp_path):
    # Only phase-attributable targets contribute entries to
    # `failedBudgetTargetDetails` when they actually breach. This isolates
    # the shard-attribution payload to the targets carrying per-shard
    # evidence.
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
        assert payload["budgetTargets"][target] is True
    assert payload["failedBudgetTargetDetails"] == {}
