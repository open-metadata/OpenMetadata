"""Behavioral checks for the merge-queue gate and retry reporting."""

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
    return workflow("reusable-playwright-e2e.yml")["jobs"]["playwright-ci"]["steps"]


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



def test_retry_report_filters_and_combines_all_retry_passes(tmp_path):
    coverage = next(step for step in shard_steps() if step.get("id") == "verify-shard-coverage")
    report_part = coverage["run"][coverage["run"].index('results="$GITHUB_WORKSPACE'):]
    output = tmp_path / "openmetadata-ui/src/main/resources/ui/playwright/output"
    output.mkdir(parents=True)

    def spec(title, status, attempts):
        return {
            "title": title,
            "file": "Features/Sample.spec.ts",
            "line": 1,
            "tests": [{"status": status, "results": [{"status": s} for s in attempts]}],
        }

    titles = ["retry pass"] + [f"flaky {index:02d}" for index in range(11)] + ["50% done"]
    specs = [
        spec("first attempt", "expected", ["passed"]),
        *(spec(title, "flaky", ["failed", "passed"]) for title in titles),
        spec("real failure", "unexpected", ["failed", "failed"]),
    ]
    (output / "results.json").write_text(json.dumps({"suites": [{"specs": specs}]}))
    summary = tmp_path / "summary.md"
    summary.touch()
    result = subprocess.run(
        ["bash", "-e", "-c", report_part],
        env={
            **os.environ,
            "GITHUB_WORKSPACE": str(tmp_path),
            "GITHUB_STEP_SUMMARY": str(summary),
            "SHARD_ID": "chromium-01",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    text = summary.read_text()
    assert all(title in text for title in titles)
    assert "first attempt" not in text
    assert "real failure" not in text
    [warning] = [line for line in result.stdout.splitlines() if line.startswith("::warning")]
    message = warning.split("::", 2)[2].replace("%0A", "\n").replace("%25", "%")
    assert sorted(line.split(" › ")[1] for line in message.splitlines()) == sorted(titles)
