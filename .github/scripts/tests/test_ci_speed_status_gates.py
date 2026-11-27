#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Every CI component reports through one status gate action that always runs."""

import json
import os
import re
import subprocess
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github/workflows"
ACTIONS = ROOT / ".github/actions"
GATE_ACTION = ".github/actions/ci-status-gate"
ENTRYPOINTS = ("ci-pr.yml", "ci-merge-queue.yml")
GATES = ("py-tests-status", "ui-tests-status", "backend-checks-status")
REQUIRED_CHECKS = ROOT / ".github/ci/required-checks.txt"

SELECTED = re.compile(
    r"\$\{\{ needs\.plan\.outputs\.([\w-]+) == 'true' && 'success' \|\| 'skipped' \}\}"
)
STEP_OUTCOME = re.compile(r"\$\{\{ steps\.([\w-]+)\.outcome \}\}")
PLAN_RESULT = "${{ needs.plan.result }}"
EXPECTED_LINE = re.compile(r'^\s*"([\w-]+)": "(.*)",?$', re.MULTILINE)
NEEDS_LINE = re.compile(r'^\s*"([\w-]+)": \{"result": "(.*)"\},?$', re.MULTILINE)
# Whatever a workflow would need to check results on its own.
OWN_GATE_RULES = (
    re.compile(r"^\s*check\(\)\s*\{", re.MULTILINE),
    re.compile(r"--argjson expected"),
    re.compile(r"EXPECTED_RESULTS"),
)

# Keys each entrypoint sets for itself in a job the two workflows share.
ENTRYPOINT_OWNED = {
    "plan": {"with"},
    "backend": {"if"},
    "ui-checkstyle": {"if"},
    "ui-coverage": {"if"},
}


def jobs(workflow: str) -> dict:
    return yaml.load((WORKFLOWS / workflow).read_text(), Loader=yaml.BaseLoader)["jobs"]


def needs_of(job: dict) -> list[str]:
    needs = job.get("needs", [])
    return [needs] if isinstance(needs, str) else list(needs)


def gate_step(job: dict) -> tuple[int, dict]:
    [found] = [
        (index, step)
        for index, step in enumerate(job.get("steps", []))
        if step.get("uses", "").endswith(GATE_ACTION)
    ]
    return found


def run_gate(needs: dict, expected: dict) -> subprocess.CompletedProcess:
    action = yaml.safe_load((ROOT / GATE_ACTION / "action.yml").read_text())
    [step] = action["runs"]["steps"]
    return subprocess.run(
        ["bash", "-eo", "pipefail", "-c", step["run"]],
        env={
            **os.environ,
            "NEEDS_JSON": json.dumps(needs),
            "EXPECTED_RESULTS": json.dumps(expected),
        },
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )


def render(template: str, outputs: dict, results: dict) -> dict:
    """Evaluate the only expressions a gate template may contain."""
    text = SELECTED.sub(
        lambda match: "success" if outputs.get(match[1]) == "true" else "skipped",
        template,
    )
    text = text.replace(PLAN_RESULT, results["plan"])
    text = STEP_OUTCOME.sub(lambda match: results.get(match[1], "skipped"), text)
    assert "${{" not in text, text
    return json.loads(text)


def evaluate(workflow: str, gate: str, outputs: dict, results: dict):
    """Run a workflow's gate as GitHub would, from planner outputs and results."""
    job = jobs(workflow)[gate]
    _, step = gate_step(job)
    expected = render(step["with"]["expected"], outputs, results)
    if step["with"]["needs"] == "${{ toJSON(needs) }}":
        needs = {name: {"result": results.get(name, "skipped")} for name in needs_of(job)}
    else:
        needs = render(step["with"]["needs"], outputs, results)
    return run_gate(needs, expected)


# The action, tested once.


@pytest.mark.parametrize("wanted", ["success", "skipped"])
def test_gate_accepts_declared_results(wanted):
    result = run_gate(
        {"plan": {"result": "success"}, "some-job": {"result": wanted}},
        {"plan": "success", "some-job": wanted},
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("actual", ["failure", "cancelled", "skipped", None])
def test_gate_rejects_unsuccessful_required_work(actual):
    needs = {"plan": {"result": "success"}}
    if actual:
        needs["some-job"] = {"result": actual}
    result = run_gate(needs, {"plan": "success", "some-job": "success"})
    assert result.returncode != 0
    got = actual or "missing"
    assert f"::error::some-job: expected success, got {got}" in result.stdout


def test_gate_rejects_unexpected_results_and_dependencies():
    assert run_gate({"a": {"result": "success"}}, {"a": "skipped"}).returncode != 0
    assert run_gate({"a": {"result": "success"}}, {"a": "failure"}).returncode != 0
    assert run_gate({"a": {"result": "success"}}, {}).returncode != 0
    assert run_gate({}, {}).returncode != 0
    result = run_gate(
        {"a": {"result": "success"}, "omitted-job": {"result": "failure"}},
        {"a": "success"},
    )
    assert result.returncode != 0
    assert "::error::omitted-job: has no expected result" in result.stdout


# Every gate use follows the same rule.


def test_the_six_gates_are_the_only_users_of_the_action():
    users = {
        (path.name, name)
        for path in WORKFLOWS.glob("*.y*ml")
        for name, job in jobs(path.name).items()
        if any(step.get("uses", "").endswith(GATE_ACTION) for step in job.get("steps", []))
    }
    assert users == {(workflow, gate) for workflow in ENTRYPOINTS for gate in GATES}


@pytest.mark.parametrize("gate", GATES)
@pytest.mark.parametrize("workflow", ENTRYPOINTS)
def test_every_gate_always_runs_and_expects_each_dependency(workflow, gate):
    all_jobs = jobs(workflow)
    job = all_jobs[gate]
    # A job skipped by `if` reports success, so only event and draft filters.
    assert job["if"].startswith("${{ always() ")
    assert "needs.plan.outputs" not in job["if"]

    index, step = gate_step(job)
    assert step["uses"] == f"./{GATE_ACTION}"
    expected = dict(EXPECTED_LINE.findall(step["with"]["expected"]))
    assert expected.pop("plan") == "success"
    if step["with"]["needs"] == "${{ toJSON(needs) }}":
        checkout = job["steps"][index - 1]
        assert checkout["with"]["sparse-checkout"] == GATE_ACTION
        assert set(expected) == set(needs_of(job)) - {"plan"}
        conditions = {name: all_jobs[name]["if"] for name in expected}
    else:
        # The suites run as steps of the gate's own job. Its one checkout always
        # runs and fetches only the gate action when no suite is selected.
        checkout = job["steps"][0]
        assert "if" not in checkout
        assert checkout["with"]["sparse-checkout"] == (
            "${{ needs.plan.outputs.static != 'true' && '" + GATE_ACTION + "' || '' }}"
        )
        assert step["if"] == "${{ always() }}"
        sources = dict(NEEDS_LINE.findall(step["with"]["needs"]))
        assert sources.pop("plan") == PLAN_RESULT
        assert set(sources) == set(expected)
        step_ids = {name: STEP_OUTCOME.fullmatch(value)[1] for name, value in sources.items()}
        suites = {s["id"]: s for s in job["steps"] if "id" in s}
        assert set(step_ids.values()) == set(suites)
        conditions = {name: suites[step_ids[name]]["if"] for name in expected}
    assert checkout["uses"].startswith("actions/checkout@")
    assert checkout["with"]["persist-credentials"] == "false"
    for name, template in expected.items():
        output = SELECTED.fullmatch(template)[1]
        assert f"needs.plan.outputs.{output} == 'true'" in conditions[name], name


@pytest.mark.parametrize("gate", GATES)
@pytest.mark.parametrize("workflow", ENTRYPOINTS)
def test_every_gate_rejects_a_failed_planner_when_nothing_runs(workflow, gate):
    result = evaluate(workflow, gate, {}, {"plan": "failure"})
    assert result.returncode != 0
    assert "::error::plan: expected success, got failure" in result.stdout


@pytest.mark.parametrize("gate", GATES)
@pytest.mark.parametrize("workflow", ENTRYPOINTS)
def test_every_gate_passes_when_nothing_is_selected(workflow, gate):
    result = evaluate(workflow, gate, {}, {"plan": "success"})
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize(
    ("outputs", "results", "error"),
    [
        pytest.param({"static": "true"}, {"static": "success"}, None, id="lint-only"),
        pytest.param(
            {"static": "true", "python": "true"},
            {"static": "failure", "unit": "success"},
            "python-static-checks: expected success, got failure",
            id="static-fails",
        ),
        pytest.param(
            {"static": "true", "python": "true"},
            {"static": "success", "unit": "skipped"},
            "python-unit: expected success, got skipped",
            id="unit-skipped",
        ),
        pytest.param(
            {"static": "true"},
            {"static": "success", "airflow": "success"},
            "airflow-apis: expected skipped, got success",
            id="unselected-suite-ran",
        ),
    ],
)
def test_pr_python_gate_checks_each_suite_step(outputs, results, error):
    result = evaluate("ci-pr.yml", "py-tests-status", outputs, {"plan": "success", **results})
    if error:
        assert result.returncode != 0
        assert f"::error::{error}" in result.stdout
    else:
        assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize(
    ("outputs", "results", "error"),
    [
        pytest.param(
            {"checkstyle": "true", "java-unit": "true"},
            {"backend-checks": "success"},
            None,
            id="java-change",
        ),
        pytest.param(
            {"checkstyle": "true", "java-unit": "true"},
            {"backend-checks": "failure"},
            "backend-checks: expected success, got failure",
            id="backend-failure",
        ),
        pytest.param(
            {"java-operator": "true"},
            {"k8s_operator-unit-tests": "cancelled"},
            "k8s_operator-unit-tests: expected success, got cancelled",
            id="operator-cancelled",
        ),
        pytest.param(
            {},
            {"docker-image-smoke-test": "failure"},
            "docker-image-smoke-test: expected skipped, got failure",
            id="unselected-job-ran",
        ),
    ],
)
def test_pr_backend_gate_checks_selected_jobs(outputs, results, error):
    result = evaluate("ci-pr.yml", "backend-checks-status", outputs, {"plan": "success", **results})
    if error:
        assert result.returncode != 0
        assert f"::error::{error}" in result.stdout
    else:
        assert result.returncode == 0, result.stdout + result.stderr


INTEGRATION = {"java-it": "true", "java-it-redis": "true"}
INTEGRATION_PASSED = {
    "integration-test-build": "success",
    "it-mysql-elasticsearch": "success",
    "it-postgres-opensearch": "success",
    "it-postgres-elasticsearch-redis": "success",
}


@pytest.mark.parametrize(
    ("outputs", "results", "error"),
    [
        pytest.param(INTEGRATION, INTEGRATION_PASSED, None, id="integration-only"),
        pytest.param(
            {**INTEGRATION, "checkstyle": "true", "java-unit": "true"},
            {**INTEGRATION_PASSED, "backend-checks": "success"},
            None,
            id="backend-and-integration-succeed",
        ),
        pytest.param({}, {}, None, id="irrelevant-change"),
        pytest.param(
            {**INTEGRATION, "checkstyle": "true", "java-unit": "true"},
            {"backend-checks": "failure"},
            "backend-checks: expected success, got failure",
            id="backend-failure",
        ),
        pytest.param(
            {**INTEGRATION, "checkstyle": "true", "java-unit": "true"},
            {"backend-checks": "cancelled"},
            "backend-checks: expected success, got cancelled",
            id="backend-cancelled",
        ),
        pytest.param(
            INTEGRATION,
            {**INTEGRATION_PASSED, "integration-test-build": "failure"},
            "integration-test-build: expected success, got failure",
            id="build-failure",
        ),
        pytest.param(
            INTEGRATION,
            {**INTEGRATION_PASSED, "it-mysql-elasticsearch": "skipped"},
            "it-mysql-elasticsearch: expected success, got skipped",
            id="mysql-skipped",
        ),
        pytest.param(
            INTEGRATION,
            {**INTEGRATION_PASSED, "it-postgres-opensearch": "cancelled"},
            "it-postgres-opensearch: expected success, got cancelled",
            id="opensearch-cancelled",
        ),
        pytest.param(
            INTEGRATION,
            {**INTEGRATION_PASSED, "it-postgres-elasticsearch-redis": "failure"},
            "it-postgres-elasticsearch-redis: expected success, got failure",
            id="redis-failure",
        ),
        pytest.param(
            {"java-it": "true"},
            {**INTEGRATION_PASSED, "it-postgres-elasticsearch-redis": "skipped"},
            None,
            id="redis-not-selected",
        ),
    ],
)
def test_merge_queue_backend_gate_verifies_selected_integration_jobs(outputs, results, error):
    result = evaluate(
        "ci-merge-queue.yml", "backend-checks-status", outputs, {"plan": "success", **results}
    )
    if error:
        assert result.returncode != 0
        assert f"::error::{error}" in result.stdout
    else:
        assert result.returncode == 0, result.stdout + result.stderr


def test_no_workflow_defines_its_own_gate_rule():
    files = [*WORKFLOWS.glob("*.y*ml"), *ACTIONS.glob("*/action.y*ml")]
    offenders = [
        f"{path.relative_to(ROOT)}: {rule.pattern}"
        for path in files
        if path.parent != ROOT / GATE_ACTION
        for rule in OWN_GATE_RULES
        if rule.search(path.read_text())
    ]
    assert offenders == []


# Required check names and the jobs both entrypoints share.


def required_checks() -> list[str]:
    lines = REQUIRED_CHECKS.read_text().splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith("#")]


@pytest.mark.parametrize("workflow", ENTRYPOINTS)
def test_required_checks_are_top_level_jobs_of_both_entrypoints(workflow):
    names = required_checks()
    assert names == sorted(set(names))
    assert set(GATES) <= set(names)
    reported = {job.get("name", name) for name, job in jobs(workflow).items() if "uses" not in job}
    assert set(names) <= reported


def test_jobs_shared_by_both_entrypoints_are_identical():
    pr, queue = jobs("ci-pr.yml"), jobs("ci-merge-queue.yml")
    shared = (pr.keys() & queue.keys()) - set(GATES)
    assert set(ENTRYPOINT_OWNED) <= shared
    for name in sorted(shared):
        owned = ENTRYPOINT_OWNED.get(name, set())
        for key in owned:
            assert pr[name][key] != queue[name][key], f"{name}.{key} no longer differs"
        same = {key: value for key, value in pr[name].items() if key not in owned}
        assert same == {key: value for key, value in queue[name].items() if key not in owned}, name
