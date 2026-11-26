from __future__ import annotations

import importlib.util
import os
import shlex
import subprocess
from pathlib import Path

import pytest
import yaml


ROOT = Path(__file__).parents[3]
SPEC = importlib.util.spec_from_file_location(
    "pr_workflow_security", ROOT / ".github/scripts/check_pr_workflow_security.py"
)
security = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(security)


def workflow(tmp_path, job, *, extra=None):
    directory = tmp_path / ".github/workflows"
    directory.mkdir(parents=True, exist_ok=True)
    document = {
        "on": {"pull_request": {}, "push": {}},
        "permissions": {"contents": "read"},
        "jobs": {"test": {"runs-on": "ubuntu-latest", **job}},
        **(extra or {}),
    }
    path = directory / "pr.yml"
    path.write_text(yaml.safe_dump(document))
    return security.check_workflows(tmp_path)


@pytest.mark.parametrize(
    "expression",
    [
        "${{ secrets.COLLATE_PAT }}",
        "${{ secrets.GITHUB_TOKEN_EXTRA }}",
        "${{ SECRETS.COLLATE_PAT }}",
        "${{ toJSON(SeCrEtS) }}",
        "${{ '}}' && secrets.REPO_TOKEN }}",
        "${{ 'it''s }}' && SECRETS['TOKEN'] }}",
        "${{ secrets['TOKEN'] }}",
        "${{ secrets[format('{0}_SSO_PASSWORD', matrix.provider)] }}",
        "${{ toJSON(secrets) }}",
    ],
)
def test_pr_cannot_reference_credentials(tmp_path, expression):
    errors = workflow(
        tmp_path, {"steps": [{"run": "make test", "env": {"TOKEN": expression}}]}
    )
    assert any("remove secret references" in error for error in errors)


def test_same_repository_guard_does_not_authorize_secrets(tmp_path):
    errors = workflow(
        tmp_path,
        {
            "if": "github.event.pull_request.head.repo.full_name == github.repository",
            "env": {"TOKEN": "${{ secrets.TOKEN }}"},
        },
    )
    assert any("remove secret references" in error for error in errors)


@pytest.mark.parametrize(
    "permissions", [{"contents": "write"}, {"id-token": "write"}, "write-all"]
)
def test_pr_cannot_receive_write_permissions(tmp_path, permissions):
    assert any(
        "read-only" in error
        for error in workflow(tmp_path, {"permissions": permissions})
    )


def test_read_token_and_explicit_non_pr_jobs_are_allowed(tmp_path):
    assert workflow(tmp_path, {"env": {"TOKEN": "${{ secrets.GITHUB_TOKEN }}"}}) == []
    assert workflow(tmp_path, {"env": {"TOKEN": "${{ SECRETS.github_token }}"}}) == []
    assert (
        workflow(
            tmp_path,
            {
                "if": "${{ !cancelled() && github.event_name != 'pull_request' && needs.changes.outputs.run == 'true' }}",
                "permissions": {"contents": "write"},
                "env": {"TOKEN": "${{ secrets.TOKEN }}"},
            },
        )
        == []
    )


def test_or_branch_cannot_bypass_event_exclusion(tmp_path):
    errors = workflow(
        tmp_path,
        {
            "if": "github.event_name != 'pull_request' || github.actor == 'maintainer'",
            "env": {"TOKEN": "${{ secrets.TOKEN }}"},
        },
    )
    assert any("remove secret references" in error for error in errors)


def test_case_insensitive_event_comparison_cannot_hide_a_pr_job(tmp_path):
    errors = workflow(
        tmp_path,
        {
            "if": "github.event_name == 'PULL_REQUEST'",
            "env": {"TOKEN": "${{ SECRETS.TOKEN }}"},
            "permissions": {"contents": "write"},
        },
    )
    assert any("remove secret references" in error for error in errors)
    assert any("read-only" in error for error in errors)


def test_global_environment_and_job_environment_are_checked(tmp_path):
    assert any(
        "remove secret references" in error
        for error in workflow(
            tmp_path, {}, extra={"env": {"TOKEN": "${{ secrets.TOKEN }}"}}
        )
    )
    assert any(
        "remove the environment" in error
        for error in workflow(tmp_path, {"environment": "test"})
    )


def test_local_reusable_workflows_are_checked_without_secret_forwarding(tmp_path):
    workflow(tmp_path, {})
    called = tmp_path / ".github/workflows/shared.yml"
    called.write_text(
        yaml.safe_dump(
            {
                "on": {"workflow_call": {}},
                "jobs": {"test": {"env": {"TOKEN": "${{ secrets.TOKEN }}"}}},
            }
        )
    )
    errors = workflow(
        tmp_path, {"uses": "./.github/workflows/shared.yml", "secrets": "inherit"}
    )
    assert any("remove secrets forwarding" in error for error in errors)
    assert any(
        "shared.yml" in error and "remove secret references" in error
        for error in errors
    )


def test_checkout_does_not_persist_credentials(tmp_path):
    assert any(
        "persist-credentials: false" in error
        for error in workflow(tmp_path, {"steps": [{"uses": "actions/checkout@v7"}]})
    )
    assert (
        workflow(
            tmp_path,
            {
                "steps": [
                    {
                        "uses": "actions/checkout@v7",
                        "with": {"persist-credentials": False},
                    }
                ]
            },
        )
        == []
    )


def test_pr_file_detection_retains_required_read_access(tmp_path):
    job = {"steps": [{"uses": "dorny/paths-filter@v4"}]}
    assert any("pull-requests: read" in error for error in workflow(tmp_path, job))
    assert workflow(tmp_path, {**job, "permissions": {"pull-requests": "read"}}) == []


@pytest.mark.parametrize(
    "condition,excluded",
    [
        (
            "(github.event_name != 'pull_request') && (needs.test.result == 'success')",
            True,
        ),
        (
            "(github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && always()",
            True,
        ),
        ("(github.event_name != 'pull_request') || (always())", False),
        ("github.event_name == 'PULL_REQUEST'", False),
        ("github.event_name != 'Pull_Request'", True),
        (
            "fromJSON(format('{{\"false\":{0}}}', true))[true && github.event_name != 'pull_request' && false]",
            False,
        ),
        ("contains('github.event_name != ''pull_request''', github.actor)", False),
    ],
)
def test_event_exclusion_is_conservative(condition, excluded):
    assert security.excludes_pull_request(condition) == excluded


def test_repository_pr_workflows_are_secret_free():
    assert security.check_workflows() == []


@pytest.mark.parametrize(
    "filename,job_id,step_name",
    [
        (
            "typescript-type-generation.yml",
            "generate-types",
            "Fail workflow when generated sources are stale",
        ),
    ],
)
def test_generation_drift_still_fails_without_auto_push(
    tmp_path, filename, job_id, step_name
):
    document = yaml.load(
        (ROOT / ".github/workflows" / filename).read_text(), Loader=yaml.BaseLoader
    )
    job = document["jobs"][job_id]
    step = next(step for step in job["steps"] if step.get("name") == step_name)
    assert step.get("continue-on-error", "false") == "false"
    summary = tmp_path / "summary.md"
    result = subprocess.run(
        ["bash", "-c", step["run"]],
        env={
            **os.environ,
            "GITHUB_STEP_SUMMARY": str(summary),
            "DRIFT_SUMMARY": "map changed",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "::error" in result.stdout
    assert "commit" in summary.read_text()


def test_security_check_runs_when_its_code_changes():
    document = yaml.load(
        (ROOT / ".github/workflows/validate-jsons-yamls.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    paths = document["on"]["pull_request"]["paths"]
    assert ".github/scripts/check_pr_workflow_security.py" in paths
    assert ".github/scripts/tests/test_pr_workflow_security.py" in paths
    steps = document["jobs"]["validate-json-yaml"]["steps"]
    check = next(
        step for step in steps if step.get("name") == "Verify PR workflow security"
    )
    assert not check.get("continue-on-error")
    assert "python .github/scripts/check_pr_workflow_security.py" in check["run"]


def test_airflow_sonar_settings_resolve_from_the_workspace():
    document = yaml.load(
        (ROOT / ".github/workflows/airflow-apis-tests.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    scan = next(
        step
        for step in document["jobs"]["airflow-apis-sonar"]["steps"]
        if step.get("uses", "").startswith("SonarSource/sonarqube-scan-action@")
    )["with"]
    settings = next(
        (
            arg.split("=", 1)[1]
            for arg in shlex.split(scan.get("args", ""))
            if arg.startswith("-Dproject.settings=")
        ),
        str(Path(scan["projectBaseDir"]) / "sonar-project.properties"),
    )
    path = ROOT / settings
    assert path.is_file(), (
        f"Sonar settings do not exist relative to the workspace: {settings}"
    )
    assert path.parent.resolve() == (ROOT / scan["projectBaseDir"]).resolve()


@pytest.mark.parametrize(
    "filename",
    [
        "typescript-type-generation.yml",
    ],
)
def test_manual_generation_checkouts_stay_in_the_event_cache_scope(filename):
    document = yaml.load(
        (ROOT / ".github/workflows" / filename).read_text(), Loader=yaml.BaseLoader
    )
    assert not (document["on"]["workflow_dispatch"] or {}).get("inputs"), (
        "Manual generation must use its event ref, not a separately supplied PR or branch"
    )
    for job in document["jobs"].values():
        for step in job.get("steps", []):
            if step.get("uses", "").startswith("actions/checkout@"):
                options = step.get("with", {})
                assert (
                    options.get("repository", "${{ github.repository }}")
                    == "${{ github.repository }}"
                )
                assert (
                    options["ref"]
                    == "${{ github.event.pull_request.head.sha || github.sha }}"
                )
