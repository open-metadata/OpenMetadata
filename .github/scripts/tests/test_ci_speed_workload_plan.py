"""Exercise workload routing and planning failure gates."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github/workflows"


def run_plan(tmp_path, entrypoint, event, payload, matches):
    event_path = tmp_path / "event.json"
    event_path.write_text(json.dumps(payload))
    outputs = tmp_path / "outputs"
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/ci_plan.py"), entrypoint],
        env={
            **os.environ,
            "GITHUB_EVENT_NAME": event,
            "GITHUB_EVENT_PATH": str(event_path),
            "GITHUB_OUTPUT": str(outputs),
            "MATCHED_FILTERS": matches,
        },
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    return result, outputs


@pytest.mark.parametrize(
    ("entrypoint", "event", "payload", "matches", "expected"),
    [
        (
            "pr",
            "pull_request",
            {"action": "synchronize", "pull_request": {"draft": False}},
            ["java-checkstyle", "java-unit", "java-integration", "python-backend"],
            {"checkstyle", "java-unit"},
        ),
        (
            "merge-queue",
            "merge_group",
            {},
            ["java-checkstyle", "java-unit", "java-integration", "python-backend"],
            {
                "checkstyle",
                "java-unit",
                "java-it",
                "java-it-redis",
                "python",
                "static",
                "json-yaml",
            },
        ),
        (
            "merge-queue",
            "merge_group",
            {},
            ["rdf"],
            {"java-it", "json-yaml"},
        ),
        (
            "merge-queue",
            "push",
            {},
            [
                "java-unit",
                "java-integration",
                "python",
                "airflow-apis",
                "dar",
            ],
            {
                "checkstyle",
                "java-unit",
                "java-it",
                "java-it-redis",
                "dar",
            },
        ),
        (
            "pr",
            "pull_request",
            {"action": "opened", "pull_request": {"draft": True}},
            ["java-unit", "python", "airflow-apis", "json-yaml", "quickstart-compose"],
            {"json-yaml", "quickstart-compose"},
        ),
        (
            "pr",
            "pull_request",
            {"action": "ready_for_review", "pull_request": {"draft": False}},
            ["airflow-apis", "json-yaml", "quickstart-compose"],
            {"airflow-apis", "static"},
        ),
        (
            "merge-queue",
            "merge_group",
            {},
            [],
            {"json-yaml"},
        ),
        (
            "pr",
            "workflow_dispatch",
            {},
            [],
            {"python", "airflow-apis", "static"},
        ),
        (
            "pr",
            "workflow_dispatch",
            {"inputs": {"workload": "quickstart-compose"}},
            [],
            {"quickstart-compose"},
        ),
        (
            "merge-queue",
            "workflow_dispatch",
            {"inputs": {"workload": "java"}},
            [],
            {
                "checkstyle",
                "java-unit",
                "java-operator",
                "docker-smoke",
                "java-it",
                "java-it-redis",
            },
        ),
    ],
)
def test_workloads_selected_for_event(
    tmp_path, entrypoint, event, payload, matches, expected
):
    result, outputs = run_plan(
        tmp_path, entrypoint, event, payload, json.dumps(matches)
    )

    assert result.returncode == 0, result.stderr
    selected = {
        name
        for name, value in (
            line.split("=", 1) for line in outputs.read_text().splitlines()
        )
        if json.loads(value)
    }
    assert selected == expected


def test_missing_path_detection_result_fails_planning(tmp_path):
    result, outputs = run_plan(tmp_path, "merge-queue", "push", {}, "")

    assert result.returncode != 0
    assert not outputs.exists()


def test_one_nightly_schedule_runs_java_without_waiting_for_python():
    workflow = yaml.load((WORKFLOWS / "ci-nightly.yml").read_text(), Loader=yaml.BaseLoader)
    assert workflow["on"]["schedule"] == [{"cron": "0 1 * * *"}]

    jobs = workflow["jobs"]
    for name in ("integration-test-build", "maven-sonarcloud-ci"):
        assert "needs" not in jobs[name]
        assert jobs[name]["if"] == "${{ github.event_name == 'schedule' }}"
    assert jobs["it-mysql-elasticsearch"]["needs"] == "integration-test-build"
    assert jobs["it-mysql-elasticsearch"]["with"]["store_database_version"] == "oldest"

    callers = set()
    for path in WORKFLOWS.glob("*.y*ml"):
        workflow = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
        for name, job in workflow["jobs"].items():
            if any(
                step.get("uses") == "./.github/actions/java-sonar"
                for step in job.get("steps", [])
            ):
                callers.add((path.name, name))
    assert callers == {("ci-nightly.yml", "maven-sonarcloud-ci")}


@pytest.mark.parametrize("workflow", ["ci-pr.yml", "ci-merge-queue.yml"])
def test_backend_gate_rejects_failed_planner_when_nothing_runs(workflow):
    jobs = yaml.safe_load((WORKFLOWS / workflow).read_text())["jobs"]
    gate = jobs["backend-checks-status"]["steps"][0]
    env = dict.fromkeys(gate["env"], "false")
    env["CHANGES_RESULT"] = "failure"

    result = subprocess.run(
        ["bash", "-e", "-c", gate["run"]],
        env={**os.environ, **env},
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )

    assert result.returncode != 0
    assert "CI planning did not succeed" in result.stdout
