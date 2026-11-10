from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest
import yaml


WORKFLOWS = Path(__file__).parents[2] / "workflows"
ROOT = WORKFLOWS.parents[1]


def test_format_check_and_lint_remain_separate_commands():
    formatting = subprocess.check_output(
        ["make", "-n", "py_format_check"], cwd=ROOT, text=True
    )
    for formatter in ("pycln", "isort", "black"):
        assert formatter in formatting
    assert "pylint" not in formatting
    lint = subprocess.check_output(["make", "-n", "lint"], cwd=ROOT, text=True)
    assert "pylint" in lint


@pytest.mark.parametrize(
    "filename",
    [
        "integration-tests-mysql-elasticsearch.yml",
        "integration-tests-postgres-opensearch.yml",
        "playwright-postgresql-e2e.yml",
    ],
)
def test_required_workflows_run_on_pr_updates_without_label_authorization(filename):
    text = (WORKFLOWS / filename).read_text()
    workflow = yaml.safe_load(text)
    events = workflow.get("on", workflow.get(True))
    assert "pull_request_target" not in events
    assert {"opened", "synchronize", "reopened", "ready_for_review"} <= set(
        events["pull_request"]["types"]
    )
    assert "labeled" not in events["pull_request"]["types"]
    assert "safe to test" not in text


@pytest.mark.parametrize(
    "filename",
    [
        "integration-tests-mysql-elasticsearch.yml",
        "integration-tests-postgres-opensearch.yml",
    ],
)
def test_java_report_publishing_requires_a_writable_pr_token(filename):
    workflow = yaml.safe_load((WORKFLOWS / filename).read_text())
    report = next(
        step
        for job in workflow["jobs"].values()
        for step in job.get("steps", [])
        if step.get("name") == "Publish Test Report"
    )
    assert "head.repo.full_name == github.repository" in report["if"]
    assert "github.actor != 'dependabot[bot]'" in report["if"]


@pytest.mark.parametrize(
    "changes,expected,build,tests,exit_code",
    [
        ("success", "true", "success", "success", 0),
        ("success", "true", "failure", "skipped", 1),
        ("success", "true", "success", "failure", 1),
        ("success", "true", "success", "cancelled", 1),
        ("success", "true", "success", "skipped", 1),
        ("success", "false", "skipped", "skipped", 0),
        ("failure", "", "skipped", "skipped", 1),
        ("cancelled", "", "skipped", "skipped", 1),
        ("success", "", "skipped", "skipped", 1),
    ],
)
def test_playwright_required_check_reports_the_actual_run_outcome(
    tmp_path, changes, expected, build, tests, exit_code
):
    jobs = yaml.safe_load((WORKFLOWS / "playwright-postgresql-e2e.yml").read_text())[
        "jobs"
    ]
    summary = jobs["playwright-summary"]
    assert "pull_request_target" not in summary["if"]
    assert "always()" in summary["if"]
    assert set(summary["needs"]) == {
        "check-changes",
        "build",
        "playwright-ci-postgresql",
    }
    assert "run_tests" in jobs["build"]["if"]
    assert "dependabot[bot]" in jobs["check-changes"]["outputs"]["run_tests"]
    gate = next(step for step in summary["steps"] if step.get("id") == "verify-run")
    result = subprocess.run(
        ["bash", "-e", "-o", "pipefail", "-c", gate["run"]],
        cwd=tmp_path,
        env={
            **os.environ,
            "CHANGES_RESULT": changes,
            "RUN_EXPECTED": expected,
            "BUILD_RESULT": build,
            "TEST_RESULT": tests,
            "GITHUB_STEP_SUMMARY": str(tmp_path / "summary.md"),
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == exit_code, result.stdout + result.stderr
