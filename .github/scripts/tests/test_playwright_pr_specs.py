from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

SCRIPTS = Path(__file__).parents[1]
UI = Path("openmetadata-ui/src/main/resources/ui")


def run_script(name, *args, cwd):
    return subprocess.run(
        [sys.executable, str(SCRIPTS / f"{name}.py"), *map(str, args)],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def test_pr_routes_every_changed_spec_and_ignores_deleted_specs(tmp_path):
    files = {
        "normal": "playwright/e2e/Features/New.spec.ts",
        "auth": "playwright/e2e/Auth/NewLogin.spec.ts",
        "rdf": "playwright/e2e/Features/OntologyNewRdf.spec.ts",
        "visual": "playwright/e2e/VisualRegression/New.spec.ts",
        "http2": "playwright/e2e/Http2/New.spec.ts",
        "nightly": "playwright/e2e/nightly/New.spec.ts",
        "helpers": "playwright/helper-tests/New.spec.ts",
    }
    for spec in files.values():
        path = tmp_path / UI / spec
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("test('new', () => {});\n")
    changed = tmp_path / "changed.txt"
    changed.write_text(
        "\n".join(str(UI / spec) for spec in files.values())
        + f"\n{UI}/playwright/e2e/Features/Deleted.spec.ts\n"
        + f"{UI}/src/pages/Widget.tsx\n"
    )
    output = tmp_path / "routes.json"
    result = run_script(
        "plan_playwright_pr",
        "--changed-files",
        changed,
        "--output",
        output,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    routes = json.loads(output.read_text())["routes"]
    assert routes == {lane: [spec] for lane, spec in files.items()}


def test_unknown_playwright_spec_config_cannot_be_silently_skipped(tmp_path):
    spec = UI / "playwright/unknown/New.spec.ts"
    path = tmp_path / spec
    path.parent.mkdir(parents=True)
    path.write_text("test('new', () => {});\n")
    changed = tmp_path / "changed.txt"
    changed.write_text(str(spec) + "\n")
    result = run_script(
        "plan_playwright_pr",
        "--changed-files",
        changed,
        "--output",
        tmp_path / "routes.json",
        cwd=tmp_path,
    )
    assert result.returncode != 0
    assert "unknown/New.spec.ts" in result.stderr


@pytest.mark.parametrize(
    "results,passes",
    [
        ([], False),
        ([{"status": "skipped"}], False),
        ([{"status": "passed"}], True),
        ([{"status": "failed"}], False),
    ],
)
def test_changed_spec_requires_a_passing_execution(tmp_path, results, passes):
    spec = "playwright/e2e/Features/New.spec.ts"
    report = tmp_path / "results.json"
    report.write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "file": "Features/New.spec.ts",
                        "specs": [{"tests": [{"results": results}]}],
                    }
                ]
            }
        )
    )
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        json.dumps([spec]),
        "--report-glob",
        str(report),
        cwd=tmp_path,
    )
    assert (result.returncode == 0) is passes, result.stderr


def test_one_executed_spec_cannot_hide_another_missing_spec(tmp_path):
    report = tmp_path / "results.json"
    report.write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "file": "Features/First.spec.ts",
                        "specs": [{"tests": [{"results": [{"status": "passed"}]}]}],
                    }
                ]
            }
        )
    )
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        json.dumps(
            [
                "playwright/e2e/Features/First.spec.ts",
                "playwright/e2e/Features/Missing.spec.ts",
            ]
        ),
        "--report-glob",
        str(report),
        cwd=tmp_path,
    )
    assert result.returncode != 0
    assert "Missing.spec.ts" in result.stderr


def test_expected_failure_is_an_execution_and_preserves_playwright_semantics(tmp_path):
    report = tmp_path / "results.json"
    report.write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "file": "Features/KnownFailure.spec.ts",
                        "specs": [
                            {
                                "tests": [
                                    {
                                        "expectedStatus": "failed",
                                        "results": [{"status": "failed"}],
                                    }
                                ]
                            }
                        ],
                    }
                ]
            }
        )
    )
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        '["playwright/e2e/Features/KnownFailure.spec.ts"]',
        "--report-glob",
        report,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr


def test_pr_spec_selection_runs_whole_files_without_smoke_or_production_expansion(
    tmp_path,
):
    spec = "playwright/e2e/Features/New.spec.ts"
    path = tmp_path / UI / spec
    path.parent.mkdir(parents=True)
    path.write_text("test('new', () => {});\n")
    changed = tmp_path / "changed.txt"
    changed.write_text(f"{UI}/{spec}\n{UI}/src/Unmapped.tsx\n")
    policy = tmp_path / "policy.json"
    policy.write_text(
        json.dumps(
            {
                "mappings": [],
                "smoke": [],
                "canary": [],
                "delegatedSpecs": [],
                "sharedInfrastructure": [],
            }
        )
    )
    generated = tmp_path / "generated.json"
    generated.write_text(json.dumps({"mappings": []}))
    output = tmp_path / "selection.json"
    result = run_script(
        "select_playwright_tests",
        "--event-name",
        "pull_request",
        "--changed-files",
        changed,
        "--impact-map",
        policy,
        "--generated-impact-map",
        generated,
        "--changed-specs-only",
        "--output",
        output,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    selection = json.loads(output.read_text())
    assert selection["mode"] == "targeted"
    assert selection["selectors"] == [{"spec": spec, "projects": ["auto"]}]
    assert selection["entityMatrix"] == "full"
    assert selection["changedSpecsOnly"] is True


@pytest.mark.parametrize("lane", ["NORMAL", "AUTH", "RDF", "VISUAL", "SPECIAL"])
@pytest.mark.parametrize("outcome", ["success", "failure", "skipped", "cancelled", ""])
def test_required_pr_gate_cannot_pass_an_unexecuted_lane(tmp_path, lane, outcome):
    workflow = yaml.safe_load(
        (SCRIPTS.parent / "workflows/playwright-postgresql-e2e.yml").read_text()
    )
    gate = next(
        step
        for step in workflow["jobs"]["playwright-pr-summary"]["steps"]
        if step["name"] == "Gate changed-spec PR environments"
    )
    env = {
        **os.environ,
        "PLAN_RESULT": "success",
        "CHANGED_SPECS": '["playwright/e2e/Features/New.spec.ts"]',
        "GITHUB_STEP_SUMMARY": str(tmp_path / "summary.md"),
    }
    for name in ("NORMAL", "AUTH", "RDF", "VISUAL", "SPECIAL"):
        env[f"{name}_COUNT"] = "0"
        env[f"{name}_RESULT"] = "skipped"
    env[f"{lane}_COUNT"] = "1"
    env[f"{lane}_RESULT"] = outcome
    result = subprocess.run(
        ["bash", "-e", "-c", gate["run"]],
        env=env,
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert (result.returncode == 0) is (outcome == "success"), result.stderr


def test_every_delegated_pr_call_exposes_verified_execution():
    workflows = SCRIPTS.parent / "workflows"
    for name in (
        "playwright-sso-login-nightly.yml",
        "playwright-knowledge-graph-postgresql-e2e.yml",
        "playwright-visual.yml",
        "playwright-changed-specs.yml",
    ):
        definition = yaml.safe_load((workflows / name).read_text())
        call = definition[True]["workflow_call"]
        assert "execution_result" in call["outputs"]
        assert any(
            "verify_playwright_changed_specs.py" in step.get("run", "")
            for job in definition["jobs"].values()
            for step in job.get("steps", [])
        ), name


def load_workflow(name):
    return yaml.safe_load((SCRIPTS.parent / "workflows" / name).read_text())


def test_pr_callers_pass_no_secrets_and_only_read_permissions():
    jobs = load_workflow("playwright-postgresql-e2e.yml")["jobs"]
    for name in (
        "playwright-pr",
        "changed-auth-specs",
        "changed-rdf-specs",
        "changed-visual-specs",
        "changed-special-specs",
    ):
        job = jobs[name]
        assert "secrets" not in job, name
        assert "github.event_name == 'pull_request'" in job["if"], name
        assert all(value == "read" for value in job.get("permissions", {}).values())
    summary = jobs["playwright-pr-summary"]
    assert "pull_request" in summary["if"]
    assert all(value == "read" for value in summary["permissions"].values())
    assert jobs["playwright"]["secrets"] == "inherit"
    assert "github.event_name != 'pull_request'" in jobs["playwright"]["if"]
    assert "github.event_name != 'pull_request'" in jobs["playwright-summary"]["if"]


@pytest.mark.parametrize(
    "workflow_name,pr_job,trusted_job",
    [
        ("playwright-e2e-reusable.yml", "playwright-pr-ci", "playwright-ci"),
        ("playwright-sso-login-nightly.yml", "sso-login-pr", "sso-login"),
    ],
)
def test_pr_execution_has_no_secret_environment(workflow_name, pr_job, trusted_job):
    jobs = load_workflow(workflow_name)["jobs"]
    assert "environment" not in jobs[pr_job]
    assert "github.event_name == 'pull_request'" in jobs[pr_job]["if"]
    assert jobs[trusted_job]["environment"] == "test"
    assert "github.event_name != 'pull_request'" in jobs[trusted_job]["if"]
    assert jobs[pr_job]["steps"] == jobs[trusted_job]["steps"]
    assert all(value == "read" for value in jobs[pr_job]["permissions"].values())
    for step in jobs[pr_job]["steps"]:
        for binding in step.get("env", {}).values():
            if re.search(r"secrets\.(?!GITHUB_TOKEN\b)|secrets\[|vars\[", str(binding)):
                assert "github.event_name != 'pull_request'" in binding


def test_pr_sso_uses_fixture_providers_and_no_account_variables():
    jobs = load_workflow("playwright-sso-login-nightly.yml")["jobs"]
    pr = jobs["sso-login-pr"]
    providers = pr["strategy"]["matrix"]["provider"]
    assert "okta" not in {provider["name"] for provider in providers}
    assert len(providers) == 8
    assert not any("vars[" in value for value in pr.get("env", {}).values())
    runner = next(
        step for step in pr["steps"] if step.get("name") == "Run SSO Scenarios"
    )
    assert "github.event_name != 'pull_request'" in runner["env"]["SSO_USERNAME"]
    assert "github.event_name != 'pull_request'" in runner["env"]["SSO_PASSWORD"]
    assert runner["env"]["SSO_USERNAME"].endswith("|| env.SSO_USERNAME }}")
    assert runner["env"]["SSO_PASSWORD"].endswith("|| env.SSO_PASSWORD }}")
    assert "notify-pr" not in jobs


def test_rdf_visual_and_helpers_need_no_private_credentials():
    for name in (
        "playwright-knowledge-graph-postgresql-e2e.yml",
        "playwright-visual.yml",
        "playwright-changed-specs.yml",
    ):
        jobs = load_workflow(name)["jobs"]
        assert all("environment" not in job for job in jobs.values()), name
        assert not re.findall(r"secrets\.(?!GITHUB_TOKEN\b)\w+", json.dumps(jobs)), name


@pytest.mark.parametrize(
    "workflow_name,job_name,step_name,tool",
    [
        ("playwright-sso-login-nightly.yml", "sso-login", "Run SSO Scenarios", "npx"),
        (
            "playwright-knowledge-graph-postgresql-e2e.yml",
            "playwright-rdf-postgresql",
            "Run RDF Playwright tests",
            "npx",
        ),
        (
            "playwright-visual.yml",
            "playwright-visual-regression",
            "Run visual regression suite",
            "docker",
        ),
    ],
)
def test_dedicated_runners_receive_the_complete_changed_file_arguments(
    tmp_path, workflow_name, job_name, step_name, tool
):
    definition = yaml.safe_load(
        (SCRIPTS.parent / "workflows" / workflow_name).read_text()
    )
    step = next(
        s for s in definition["jobs"][job_name]["steps"] if s["name"] == step_name
    )
    executable = tmp_path / tool
    executable.write_text(
        f"#!{sys.executable}\n"
        "import json, os, sys\n"
        "from pathlib import Path\n"
        "Path(os.environ['ARGUMENTS_OUT']).write_text(json.dumps(sys.argv[1:]))\n"
    )
    executable.chmod(0o755)
    specs = [
        "playwright/e2e/Features/New.spec.ts",
        "playwright/e2e/Features/Two spaced.spec.ts",
    ]
    output = tmp_path / "arguments.json"
    script = step["run"].replace("${{ matrix.provider.filter }}", "--grep @basic")
    result = subprocess.run(
        ["bash", "-e", "-c", script],
        cwd=tmp_path,
        env={
            **os.environ,
            "PATH": f"{tmp_path}:{os.environ['PATH']}",
            "CHANGED_SPECS": json.dumps(specs),
            "ARGUMENTS_OUT": str(output),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    arguments = json.loads(output.read_text())
    assert all(spec in arguments for spec in specs)
