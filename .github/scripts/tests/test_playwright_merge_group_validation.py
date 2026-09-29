"""Merge-queue validation: the inline gate, shard coverage, and the retry policy."""

import json
import os
import subprocess
from pathlib import Path

import pytest
import yaml

WORKFLOWS = Path(__file__).parents[2] / "workflows"


def workflow(name):
    return yaml.safe_load((WORKFLOWS / name).read_text())


def summary_step(name):
    steps = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "steps"
    ]
    return next(step for step in steps if step["name"] == name)


def shard_steps():
    return workflow("playwright-e2e-reusable.yml")["jobs"]["playwright-ci"]["steps"]


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
def test_queue_gate_requires_every_upstream_job(tmp_path, overrides, passes):
    gate = summary_step("Gate verified merge-group shards")
    assert gate["if"] == "${{ github.event_name == 'merge_group' }}"
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


def test_queue_shards_enforce_coverage_but_allow_one_retry():
    coverage = next(step for step in shard_steps() if step.get("id") == "verify-shard-coverage")
    assert "github.event_name == 'merge_group'" in coverage["if"]
    assert not coverage.get("continue-on-error", False)
    assert '"$(git rev-parse HEAD)" != "$GITHUB_SHA"' in coverage["run"]
    assert "--require-native-evidence" in coverage["run"]
    # The queue keeps one retry for now (#32833), so a retry pass must not fail
    # coverage. Tightening the queue to zero retries adds this flag back.
    assert "--require-single-attempt" not in coverage["run"]


def test_retry_policy_is_zero_on_prs_and_one_elsewhere():
    caller = workflow("playwright-postgresql-e2e.yml")
    expression = caller["jobs"]["playwright"]["with"]["retries"]
    assert "pull_request" in expression and "pull_request_target" in expression
    assert expression.replace(" ", "").endswith("&&1||0}}")


def test_shard_status_records_execution_identity():
    status = next(
        step for step in shard_steps() if step["name"] == "Record shard execution status"
    )
    for field in ("headSha", "runId", "runAttempt"):
        assert f"{field}: ${field}" in status["run"]


def test_merge_groups_upload_no_reports():
    steps = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "steps"
    ]
    for step in steps:
        if step["name"] == "Gate verified merge-group shards":
            continue
        assert "github.event_name != 'merge_group'" in step["if"], step["name"]
    # A green queue run costs no artifact storage, but a broken one must still
    # leave evidence: re-running it locally is a different SHA on a moving base.
    for step in shard_steps():
        if not step.get("uses", "").startswith("actions/upload-artifact"):
            continue
        condition = step["if"]
        if "github.event_name != 'merge_group'" in condition:
            continue
        assert "failure()" in condition, step["name"]


def test_baseline_refresh_writes_the_data_branch_from_full_runs_on_main():
    caller = workflow("playwright-postgresql-e2e.yml")
    assert caller[True]["schedule"], "a scheduled full run must feed the baseline"
    refresh = caller["jobs"]["refresh-timing-baseline"]
    assert "github.event_name == 'schedule'" in refresh["if"]
    assert "github.event_name == 'workflow_dispatch'" in refresh["if"]
    assert "github.ref == 'refs/heads/main'" in refresh["if"]
    assert "merge_group" not in refresh["if"]
    script = "\n".join(step.get("run", "") for step in refresh["steps"])
    # main is merge-queue only: a direct push there is rejected (GH013) and
    # would reset in-flight queue entries.
    assert "HEAD:main" not in script
    [push] = [step for step in refresh["steps"] if "DATA_BRANCH" in step.get("env", {})]
    assert push["env"]["DATA_BRANCH"] == "ci/playwright-timing"
    assert 'HEAD:refs/heads/$DATA_BRANCH' in push["run"]


def test_planning_reads_the_data_branch_baseline():
    steps = workflow("playwright-e2e-reusable.yml")["jobs"]["plan-playwright"]["steps"]
    names = [step["name"] for step in steps]
    fetch = names.index("Fetch auto-refreshed timing baseline")
    assert fetch < names.index("Build duration-aware shard plans")
    step = steps[fetch]
    assert step.get("continue-on-error") is True
    assert "ci/playwright-timing" in step["run"]
    # The planner's history loop only picks up files with this name.
    assert "playwright-timing-history.json" in step["run"]
