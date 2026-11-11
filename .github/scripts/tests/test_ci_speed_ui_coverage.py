"""Guards for the speed settings of the required ui-coverage (Jest) workflow."""

from __future__ import annotations

import re
import shlex
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/yarn-coverage.yml"
UI_DIR = ROOT / "openmetadata-ui/src/main/resources/ui"


def load_workflow() -> dict:
    return yaml.safe_load(WORKFLOW.read_text())


def coverage_job() -> dict:
    return load_workflow()["jobs"]["ui-coverage-tests"]


def run_coverage_step() -> dict:
    steps = [
        step for step in coverage_job()["steps"] if step.get("id") == "yarn_coverage"
    ]
    assert len(steps) == 1, "expected exactly one step with id yarn_coverage"
    return steps[0]


def test_coverage_job_runs_on_github_hosted_ubuntu() -> None:
    assert coverage_job()["runs-on"] == "ubuntu-latest"


def test_ci_keeps_the_same_tests_and_coverage_output() -> None:
    assert shlex.split(run_coverage_step()["run"]) == [
        "yarn",
        "test:cov-summary",
        "--maxWorkers=4",
    ]
    assert run_coverage_step()["working-directory"] == "${{ env.UI_WORKING_DIRECTORY }}"
    comment = next(
        step for step in coverage_job()["steps"] if step.get("id") == "coverage_comment"
    )
    assert comment["with"]["coverage-summary-path"].endswith("/coverage-summary.json")


def test_developer_default_worker_count_is_unchanged() -> None:
    config = (UI_DIR / "jest.config.js").read_text()
    assert re.search(r"maxWorkers:\s*'50%'", config), (
        "jest.config.js default must stay for local runs"
    )


def test_no_cache_step_is_keyed_on_a_lockfile_the_repo_does_not_have() -> None:
    tracked = subprocess.run(
        ["git", "ls-files", "*package-lock.json"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    keys = [
        str(step.get("with", {}).get("key", ""))
        for job in load_workflow()["jobs"].values()
        for step in job.get("steps", [])
        if str(step.get("uses", "")).startswith("actions/cache")
    ]
    if not tracked:
        assert not [key for key in keys if "package-lock.json" in key], keys
    assert all("yarn.lock" in key for key in keys), keys


def test_workflow_triggers_and_required_gate_are_unchanged() -> None:
    document = load_workflow()
    triggers = document.get("on", document.get(True))
    assert set(triggers) == {"merge_group", "workflow_dispatch", "pull_request"}
    gate = document["jobs"]["ui-coverage"]
    assert gate["if"] == "always()"
    assert gate["needs"] == ["ui-coverage-tests"]
