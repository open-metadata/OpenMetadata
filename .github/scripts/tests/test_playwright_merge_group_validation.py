"""Verify queue validation without uploaded reports or automatic reruns."""

import json
import os
import subprocess
from pathlib import Path

import pytest
import yaml
from test_playwright_ci_planning import load_script

WORKFLOWS = Path(__file__).parents[2] / "workflows"


def workflow(name):
    return yaml.safe_load((WORKFLOWS / name).read_text())


@pytest.mark.parametrize(
    "overrides,passes",
    [
        ({}, True),
        ({"SHARD_RESULT": "failure"}, False),
        ({"SHARD_RESULT": "cancelled"}, False),
        ({"SHARD_RESULT": "skipped"}, False),
        ({"SHARD_RESULT": ""}, False),
        ({"GATE_RESULT": "failure"}, False),
        ({"SHOULD_RUN": "false"}, False),
        ({"PLAN_RESULT": "failure"}, False),
        ({"EXPECTED_MATRIX": '{"include": []}'}, False),
        ({"EXPECTED_MATRIX": '{"include": [{"shardId": ""}]}'}, False),
        (
            {"EXPECTED_MATRIX": '{"include": [{"shardId": "a"}, {"shardId": "a"}]}'},
            False,
        ),
        ({"EXPECTED_MATRIX": "{broken"}, False),
    ],
)
def test_queue_gate_uses_verified_job_results_without_reports(
    tmp_path, overrides, passes
):
    steps = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "steps"
    ]
    gate = next(
        step for step in steps if step["name"] == "Gate verified merge-group shards"
    )
    env = {
        **os.environ,
        "GATE_RESULT": "success",
        "SHOULD_RUN": "true",
        "PLAN_RESULT": "success",
        "SHARD_RESULT": "success",
        "EXPECTED_MATRIX": json.dumps({"include": [{"shardId": "chromium-01"}]}),
        **overrides,
    }
    result = subprocess.run(
        ["bash", "-e", "-c", gate["run"]],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert (result.returncode == 0) is passes, result.stderr
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "ids", [["a", "b"], ["a"], ["a", "b", "b"], ["a", "b", "c"], []]
)
def test_partition_covers_selected_tests_once(ids):
    planner = load_script("build_playwright_shards")
    units = [planner.Unit("chromium", "sample.spec.ts", "suite", test_ids={"a", "b"})]
    plans = [{"testIds": [test_id]} for test_id in ids]
    if ids == ["a", "b"]:
        planner.verify_plan_partition(units, plans)
    else:
        with pytest.raises(SystemExit, match="every selected test exactly once"):
            planner.verify_plan_partition(units, plans)


def test_reports_remain_on_prs_and_shards_enforce_queue_coverage():
    caller = workflow("playwright-postgresql-e2e.yml")
    steps = caller["jobs"]["playwright-summary"]["steps"]
    for step in steps:
        if step["name"] != "Gate verified merge-group shards":
            assert "github.event_name != 'merge_group'" in step["if"], step["name"]

    reusable = workflow("playwright-e2e-reusable.yml")
    shard_steps = reusable["jobs"]["playwright-ci"]["steps"]
    coverage = next(
        step for step in shard_steps if step.get("id") == "verify-shard-coverage"
    )
    assert not coverage.get("continue-on-error", False)
    assert "--require-native-evidence --require-single-attempt" in coverage["run"]
    assert '"$(git rev-parse HEAD)" != "$GITHUB_SHA"' in coverage["run"]
    tests = next(step for step in shard_steps if step.get("id") == "run-tests")
    assert not tests.get("continue-on-error", False)
    assert 'exit "$test_exit"' in tests["run"]
    for step in shard_steps:
        if step.get("uses", "").startswith("actions/upload-artifact"):
            assert "github.event_name != 'merge_group'" in step["if"], step["name"]
