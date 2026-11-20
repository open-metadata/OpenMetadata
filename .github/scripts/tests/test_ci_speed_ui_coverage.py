"""Check coverage-report consumption, cache inputs and the required Jest gate."""

from __future__ import annotations

import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/yarn-coverage.yml"


def load_workflow() -> dict:
    return yaml.safe_load(WORKFLOW.read_text())


def coverage_job() -> dict:
    return load_workflow()["jobs"]["ui-coverage-tests"]


def test_comment_reads_the_coverage_summary() -> None:
    comment = next(step for step in coverage_job()["steps"] if step.get("id") == "coverage_comment")
    assert comment["with"]["coverage-summary-path"].endswith("/coverage-summary.json")


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


def test_required_gate_waits_for_coverage_tests() -> None:
    document = load_workflow()
    gate = document["jobs"]["ui-coverage"]
    assert gate["if"] == "always()"
    assert gate["needs"] == ["ui-coverage-tests"]


def test_editing_this_workflow_runs_its_tests() -> None:
    # Otherwise a change to the Jest command merges without one real run.
    steps = load_workflow()["jobs"]["check-changes"]["steps"]
    [paths_filter] = [s for s in steps if s.get("id") == "filter"]
    assert ".github/workflows/yarn-coverage.yml" in yaml.safe_load(paths_filter["with"]["filters"])["ui"]
