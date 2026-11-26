"""Exercise workload routing and planning failure gates."""

import json
import os
import subprocess
import sys
from glob import iglob
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


def selected_workloads(tmp_path, entrypoint, event, payload, matches):
    result, outputs = run_plan(
        tmp_path, entrypoint, event, payload, json.dumps(matches)
    )
    assert result.returncode == 0, result.stderr
    return {
        name
        for name, value in (
            line.split("=", 1) for line in outputs.read_text().splitlines()
        )
        if json.loads(value)
    }


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
                "ci-rules",
            },
        ),
        (
            "merge-queue",
            "merge_group",
            {},
            ["rdf"],
            {"java-it", "json-yaml", "ci-rules"},
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
                "json-yaml",
                "ci-rules",
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
            [
                "java-unit",
                "python",
                "airflow-apis",
                "json-yaml",
                "ci-rules",
                "quickstart-compose",
            ],
            {"json-yaml", "ci-rules", "quickstart-compose"},
        ),
        (
            "pr",
            "pull_request",
            {"action": "ready_for_review", "pull_request": {"draft": False}},
            ["airflow-apis", "json-yaml", "ci-rules", "quickstart-compose"],
            {"airflow-apis", "static"},
        ),
        (
            "merge-queue",
            "merge_group",
            {},
            [],
            {"json-yaml", "ci-rules"},
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
    assert selected_workloads(tmp_path, entrypoint, event, payload, matches) == expected


@pytest.fixture(scope="module")
def path_filters():
    planner = yaml.safe_load((WORKFLOWS / "reusable-ci-plan.yml").read_text())
    [filter_step] = [
        step
        for step in planner["jobs"]["select"]["steps"]
        if step.get("uses", "").startswith("dorny/paths-filter@")
    ]
    return yaml.safe_load((ROOT / filter_step["with"]["filters"]).read_text())


@pytest.mark.parametrize(
    ("path", "pr_jobs", "queue_jobs"),
    [
        (
            "openmetadata-ui/pom.xml",
            {"checkstyle"},
            {"checkstyle", "json-yaml", "ci-rules"},
        ),
        (
            "openmetadata-ui/src/main/resources/ui/package.json",
            {"json-yaml"},
            {"json-yaml", "ci-rules"},
        ),
        (
            ".github/scripts/validate_ci_rules.sh",
            {"ci-rules"},
            {"json-yaml", "ci-rules"},
        ),
        (
            "scripts/validate_json_yaml.py",
            {"json-yaml", "ci-rules"},
            {"json-yaml", "ci-rules"},
        ),
        (
            "docker/development/Dockerfile.dockerignore",
            {"docker-smoke"},
            {"docker-smoke", "python", "static", "json-yaml", "ci-rules"},
        ),
        (
            "openmetadata-spec/src/main/resources/json/schema/governance/workflows/workflowDefinition.json",
            {"checkstyle", "java-unit", "python", "static", "json-yaml"},
            {
                "checkstyle",
                "java-unit",
                "java-it",
                "java-it-redis",
                "python",
                "static",
                "json-yaml",
                "ci-rules",
                "dar",
            },
        ),
        (
            ".github/scripts/configure_docker_storage.sh",
            {"ci-rules"},
            {"java-it", "java-it-redis", "python", "static", "json-yaml", "ci-rules"},
        ),
        (
            "docker/docker-compose-quickstart/docker-compose.yml",
            {"json-yaml", "quickstart-compose"},
            {"json-yaml", "ci-rules"},
        ),
        (
            ".github/workflows/ci-pr.yml",
            {
                "checkstyle",
                "java-unit",
                "docker-smoke",
                "python",
                "static",
                "json-yaml",
                "ci-rules",
            },
            {
                "checkstyle",
                "java-unit",
                "docker-smoke",
                "java-it",
                "java-it-redis",
                "python",
                "static",
                "json-yaml",
                "ci-rules",
            },
        ),
    ],
)
def test_changed_paths_select_expected_workloads(
    tmp_path, path_filters, path, pr_jobs, queue_jobs
):
    tree = tmp_path / "changed"
    changed_file = tree / path
    changed_file.parent.mkdir(parents=True)
    changed_file.touch()
    # These fixture paths exercise ordinary globs shared by Python and paths-filter.
    matches = [
        name
        for name, patterns in path_filters.items()
        if any(
            path in iglob(pattern, root_dir=tree, recursive=True, include_hidden=True)
            for pattern in patterns
        )
    ]
    pr = tmp_path / "pr"
    queue = tmp_path / "queue"
    pr.mkdir()
    queue.mkdir()
    payload = {"action": "synchronize", "pull_request": {"draft": False}}
    assert selected_workloads(pr, "pr", "pull_request", payload, matches) == pr_jobs
    assert (
        selected_workloads(queue, "merge-queue", "merge_group", {}, matches)
        == queue_jobs
    )


def test_missing_path_detection_result_fails_planning(tmp_path):
    result, outputs = run_plan(tmp_path, "merge-queue", "push", {}, "")

    assert result.returncode != 0
    assert not outputs.exists()


@pytest.mark.parametrize("workflow", ["ci-pr.yml", "ci-merge-queue.yml"])
def test_validation_actions_run_only_for_their_selected_workload(workflow):
    job = yaml.safe_load((WORKFLOWS / workflow).read_text())["jobs"]["validate-json-yaml"]
    assert job["if"] == (
        "${{ needs.plan.outputs.json-yaml == 'true' || "
        "needs.plan.outputs.ci-rules == 'true' }}"
    )
    actions = {step.get("uses"): step for step in job["steps"]}
    for workload, action in (
        ("ci-rules", "validate-ci-rules"),
        ("json-yaml", "validate-json-yaml"),
    ):
        step = actions[f"./.github/actions/{action}"]
        assert step["if"] == "${{ needs.plan.outputs." + workload + " == 'true' }}"


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
    assert gate["env"]["CHANGES_RESULT"] == "${{ needs.plan.result }}"
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
