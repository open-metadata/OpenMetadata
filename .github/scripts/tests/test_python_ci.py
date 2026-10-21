"""Exercise selection and required checks with actual GitHub job-result shapes."""

import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("python_ci", ROOT / ".github/scripts/python_ci.py")
ci = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ci)


@pytest.mark.parametrize(
    "event, paths, style, tests, versions",
    [
        ("pull_request_target", ["docs/guide.md"], False, False, ["3.12"]),
        ("merge_group", ["docs/guide.md"], False, False, ["3.12"]),
        ("pull_request_target", ["openmetadata-airflow-apis/src/api.py"], True, False, ["3.12"]),
        ("pull_request_target", ["ingestion/src/metadata/utils/helpers.py"], True, True, ["3.12"]),
        ("merge_group", ["openmetadata-spec/schema.json"], True, True, ["3.12"]),
        ("schedule", [], True, True, ["3.10", "3.11", "3.12"]),
        ("workflow_dispatch", [], True, True, ["3.12"]),
        ("merge_group", [".github/workflows/playwright-e2e-reusable.yml"], False, False, ["3.12"]),
    ],
)
def test_event_and_changed_path_selection(event, paths, style, tests, versions):
    plan = ci.select_work(event, paths, ci.read_policy())
    assert plan["run_style"] is style
    for field in ("run_static", "run_unit", "run_integration", "prepare_spacy_model", "build_backend"):
        assert plan[field] is tests
    assert plan["versions"] == versions


@pytest.mark.parametrize(
    "path",
    [
        ".github/workflows/ci-pr.yml",
        ".github/workflows/ci-merge-queue.yml",
        ".github/workflows/ci-nightly.yml",
        ".github/workflows/backend-build-reusable.yml",
        ".github/workflows/python-unit-tests-reusable.yml",
        ".github/workflows/python-integration-tests-reusable.yml",
        ".github/actions/python-checkstyle/action.yml",
        ".github/actions/setup-openmetadata-test-environment/action.yml",
        ".github/scripts/python_ci.py",
        ".github/scripts/tests/test_python_ci.py",
        ".github/scripts/tests/test_nox_cli.py",
        "ingestion/python-versions.json",
        "ingestion/noxfile.py",
        ".github/workflows/py-cli-e2e-tests.yml",
        ".github/workflows/py-cli-e2e-tests-v2.yml",
        "Makefile",
    ],
)
def test_control_changes_select_the_work_they_govern(path):
    plan = ci.select_work("pull_request_target", [path], ci.read_policy())
    assert plan["run_unit"] and plan["run_integration"]


def needs_for(plan):
    return {
        "changes": {
            "result": "success",
            "outputs": {"plan": json.dumps(plan), **{key: json.dumps(plan[key]) for key in ci.FIELDS}},
        },
        **{job: {"result": "success" if plan[field] else "skipped"} for job, field in ci.JOBS.items()},
    }


@pytest.mark.parametrize("paths", [["docs/guide.md"], ["ingestion/setup.py"]])
def test_required_checks_accept_execution_or_explicit_skips(paths):
    needs = needs_for(ci.select_work("merge_group", paths, ci.read_policy()))
    ci.verify(needs, "tests")
    ci.verify(needs, "style")


@pytest.mark.parametrize("job", ["static", "unit", "integration", "backend", "prepare-spacy-model"])
@pytest.mark.parametrize("result", ["failure", "cancelled", "skipped", None])
def test_selected_job_must_succeed(job, result):
    needs = needs_for(ci.select_work("merge_group", ["ingestion/setup.py"], ci.read_policy()))
    needs[job]["result"] = result
    with pytest.raises(ValueError, match=job):
        ci.verify(needs, "tests")


@pytest.mark.parametrize("check", ["tests", "style"])
@pytest.mark.parametrize("result", ["failure", "cancelled", "skipped", None])
def test_failed_or_absent_selection_cannot_pass(check, result):
    with pytest.raises(ValueError, match="selection"):
        ci.verify({"changes": {"result": result}}, check)


@pytest.mark.parametrize("value", [None, "false", 0])
def test_missing_and_non_boolean_selection_cannot_pass(value):
    plan = ci.select_work("merge_group", [], ci.read_policy())
    plan["run_integration"] = value
    with pytest.raises(ValueError, match="boolean"):
        ci.verify(needs_for(plan), "tests")


def test_unselected_execution_is_rejected():
    needs = needs_for(ci.select_work("merge_group", [], ci.read_policy()))
    needs["integration"]["result"] = "success"
    with pytest.raises(ValueError, match="integration"):
        ci.verify(needs, "tests")


@pytest.mark.parametrize("check", ["tests", "style"])
def test_missing_step_condition_output_cannot_skip_selected_work(check):
    needs = needs_for(ci.select_work("merge_group", ["ingestion/setup.py"], ci.read_policy()))
    del needs["changes"]["outputs"]["run_style"]
    with pytest.raises(ValueError, match="disagree"):
        ci.verify(needs, check)


@pytest.mark.parametrize("nested", [False, True])
def test_coverage_download_layouts_keep_every_file(tmp_path, nested):
    directory = tmp_path / "ingestion/coverage-data"
    names = ("unit", "mysql-1", "mysql-2", "mysql-3") if nested else ("",)
    for name in names:
        target = directory / name
        target.mkdir(parents=True, exist_ok=True)
        (target / ".coverage").write_bytes(name.encode())
    ci.prepare_coverage(tmp_path)
    results = list((tmp_path / "ingestion").glob(".coverage.ci-*"))
    assert sorted(p.read_bytes() for p in results) == sorted(name.encode() for name in names)
    assert not list(directory.rglob(".coverage"))


def test_missing_coverage_fails_reporting(tmp_path):
    with pytest.raises(ValueError, match="No coverage"):
        ci.prepare_coverage(tmp_path)


@pytest.mark.parametrize(
    "tested,image", [([], "3.12"), (["3.10", "3.10"], "3.10"), (["3.12", "3.10"], "3.12"), (["3.10"], "3.12")]
)
def test_invalid_policy_is_rejected(tmp_path, tested, image):
    directory = tmp_path / "ingestion"
    directory.mkdir()
    (directory / "python-versions.json").write_text(json.dumps({"tested": tested, "image": image}))
    with pytest.raises(ValueError):
        ci.read_policy(tmp_path)


def test_native_policy_matches_images_and_tools():
    ci.check_policy()


@pytest.mark.parametrize(
    "name, old, new",
    [
        ("ingestion/pyproject.toml", 'requires-python = ">=3.10"', 'requires-python = ">=3.11"'),
        ("ingestion/pyproject.toml", 'target-version = "py310"', 'target-version = "py311"'),
        ("ingestion/pyproject.toml", 'pythonVersion = "3.10"', 'pythonVersion = "3.11"'),
        ("ingestion/Dockerfile", "python3.12", "python3.11"),
        ("ingestion/operators/docker/Dockerfile", "python:3.12", "python:3.11"),
    ],
)
def test_policy_drift_is_rejected(tmp_path, name, old, new):
    for source in (
        "ingestion/python-versions.json",
        "ingestion/pyproject.toml",
        "ingestion/Dockerfile",
        "ingestion/Dockerfile.ci",
        "ingestion/operators/docker/Dockerfile",
        "ingestion/operators/docker/Dockerfile.ci",
    ):
        target = tmp_path / source
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, target)
    target = tmp_path / name
    target.write_text(target.read_text().replace(old, new))
    with pytest.raises(ValueError, match="drift"):
        ci.check_policy(tmp_path)


def test_cli_outputs_explicit_plan_and_preserves_failure_status(tmp_path):
    output = tmp_path / "output"
    result = subprocess.run(
        [sys.executable, str(ROOT / ".github/scripts/python_ci.py"), "plan", "--event", "merge_group"],
        env={**os.environ, "CHANGED_FILES": '["docs/guide.md"]', "GITHUB_OUTPUT": str(output)},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    outputs = dict(line.split("=", 1) for line in output.read_text().splitlines())
    assert outputs["run_unit"] == "false"
    assert json.loads(outputs["versions"]) == ["3.12"]
    result = subprocess.run(
        [sys.executable, str(ROOT / ".github/scripts/python_ci.py"), "verify"],
        env={**os.environ, "NEEDS_JSON": '{"changes":{"result":"failure"}}'},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0


def workflow(name):
    return yaml.safe_load((ROOT / ".github/workflows" / name).read_text())


@pytest.mark.parametrize(
    "name, versions",
    [
        ("ci-pr.yml", ["3.12"]),
        ("ci-merge-queue.yml", ["3.12"]),
        ("ci-nightly.yml", ["3.10", "3.11", "3.12"]),
    ],
)
def test_dispatch_runs_each_entrypoint_without_a_changed_files_result(tmp_path, name, versions):
    doc = workflow(name)
    assert "workflow_dispatch" in doc.get("on", doc.get(True))
    step = next(step for step in doc["jobs"]["changes"]["steps"] if step.get("id") == "plan")
    result = subprocess.run(
        ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", step["run"]],
        cwd=ROOT,
        env={
            **os.environ,
            "GITHUB_EVENT_NAME": "workflow_dispatch",
            "CHANGED_FILES": "",
            "GITHUB_OUTPUT": str(tmp_path / "outputs"),
        },
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    plan = json.loads(result.stdout)
    assert plan["versions"] == versions
    for field in ("run_style", "run_static", "run_unit", "run_integration", "prepare_spacy_model", "build_backend"):
        assert plan[field] is True


def test_pr_selection_still_fails_when_changed_files_are_missing():
    environment = {**os.environ, "GITHUB_EVENT_NAME": "pull_request_target"}
    environment.pop("CHANGED_FILES", None)
    result = subprocess.run(
        [sys.executable, str(ROOT / ".github/scripts/python_ci.py"), "plan"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )
    assert result.returncode != 0


@pytest.mark.parametrize("name", ["ci-pr.yml", "ci-merge-queue.yml", "ci-nightly.yml"])
def test_event_graph_preserves_required_names_and_independent_producers(name):
    doc = workflow(name)
    jobs = doc["jobs"]
    assert jobs["py-tests-status"]["name"] == "py-tests-status"
    assert jobs["py-checkstyle"]["name"] == "py-checkstyle"
    assert "always()" in jobs["py-tests-status"]["if"]
    assert "always()" in jobs["py-checkstyle"]["if"]
    assert jobs["backend"]["needs"] == "changes"
    assert jobs["static"]["needs"] == "changes"
    assert "backend" not in jobs["unit"]["needs"]
    assert "backend" in jobs["integration"]["needs"]
    assert "prepare-spacy-model" in jobs["py-tests-status"]["needs"]
    events = doc.get("on", doc.get(True))
    assert all(not value or "paths-ignore" not in value for value in events.values() if isinstance(value, dict))


def test_integration_consumes_one_build_and_preserves_shards():
    job = workflow("python-integration-tests-reusable.yml")["jobs"]["tests"]
    matrix = job["strategy"]["matrix"]
    assert len(matrix["backend"]) * len(matrix["shard"]) == 6
    names = [step["name"] for step in job["steps"]]
    assert names.index("Download backend distribution") < names.index("Setup Openmetadata Test Environment")
    assert all("-s true" in backend["args"] for backend in matrix["backend"])
    assert not any("mvn " in step.get("run", "") for step in job["steps"])


def test_nightly_sonar_preserves_full_checkout_and_failure_retry():
    jobs = workflow("ci-nightly.yml")["jobs"]
    steps = jobs["coverage"]["steps"]
    checkout = next(step for step in steps if step.get("name") == "Checkout")
    assert checkout["with"]["fetch-depth"] == 0
    assert "filter" not in checkout["with"]
    assert not jobs["coverage"].get("continue-on-error", False)
    assert any(step.get("name") == "Retry 'Push Results to Sonar'" for step in steps)


@pytest.mark.parametrize("fails", [False, True])
def test_actual_offline_control_command_preserves_pytest_failure(tmp_path, fails):
    job = workflow("python-unit-tests-reusable.yml")["jobs"]["tests"]
    script = next(step["run"] for step in job["steps"] if step.get("name") == "Run offline E2E framework tests")
    activate = tmp_path / "env/bin/activate"
    activate.parent.mkdir(parents=True)
    activate.write_text("")
    suite = tmp_path / "ingestion/tests/cli_e2e_v2/meta"
    suite.mkdir(parents=True)
    (suite / "test_control.py").write_text(f"def test_control():\n    assert {not fails!r}\n")
    result = subprocess.run(
        ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", script],
        cwd=tmp_path,
        env={**os.environ, "PYTEST_ADDOPTS": "", "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"},
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == (1 if fails else 0), result.stdout + result.stderr
    assert ("1 failed" if fails else "1 passed") in result.stdout


def test_routing_does_not_duplicate_main_required_checks():
    for name in ("py-tests.yml", "py-tests-postgres.yml", "py-checkstyle.yml"):
        doc = workflow(name)
        events = doc.get("on", doc.get(True))
        assert events["pull_request_target"]["branches-ignore"] == ["main"]
        assert events["merge_group"]["branches-ignore"] == ["main"]
