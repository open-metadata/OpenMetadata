from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parents[3]
RELEASE_BRANCH = "1.13"
SPEC = importlib.util.spec_from_file_location(
    "release_security", ROOT / ".github/scripts/check_pr_workflow_security.py"
)
security = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(security)


def load(filename):
    return yaml.load(
        (ROOT / ".github/workflows" / filename).read_text(), Loader=yaml.BaseLoader
    )


def test_privileged_pr_events_do_not_execute_unapproved_code():
    metadata_workflows = {
        "merge-queue-dequeue-report.yml",
        "pr-auto-assign.yml",
        "pr-metadata-validation.yml",
        "prune-ephemeral-caches.yml",
        "team-labeler.yml",
        "playwright-mysql-e2e-skip.yml",
        "playwright-postgresql-e2e-skip.yml",
        "backport-labeled-prs.yaml",
        "auto-cherry-pick-labeled-prs.yaml",
    }
    for path in (ROOT / ".github/workflows").glob("*.y*ml"):
        document = load(path.name)
        if "pull_request_target" not in document.get("on", {}):
            continue
        assert path.name in metadata_workflows, (
            f"PR execution must use pull_request: {path.name}"
        )
        post_merge = path.name in {
            "backport-labeled-prs.yaml",
            "auto-cherry-pick-labeled-prs.yaml",
        }
        if post_merge:
            assert document["on"]["pull_request_target"]["types"] == ["closed"]
            assert "github.event.pull_request.merged == true" in path.read_text()
        for job in document["jobs"].values():
            for step in job.get("steps", []):
                if step.get("uses", "").startswith("actions/checkout@"):
                    options = step.get("with", {})
                    assert options.get("ref", "${{ github.sha }}") in {
                        "${{ github.sha }}",
                        "${{ github.event.pull_request.base.sha }}",
                        *(["main"] if post_merge else []),
                    }, f"Privileged workflow checks out an untrusted ref: {path.name}"


@pytest.mark.parametrize(
    "filename,job_id",
    [
        ("maven-build-collate.yml", "maven-collate-ci"),
        ("airflow-apis-tests.yml", "airflow-apis-sonar"),
        *(
            [("data-access-request-e2e.yml", "data-access-request-e2e")]
            if RELEASE_BRANCH != "1.13"
            else []
        ),
    ],
)
def test_trusted_checks_follow_the_release_branch(filename, job_id):
    document = load(filename)
    assert document["on"]["push"]["branches"] == [RELEASE_BRANCH]
    condition = document["jobs"][job_id]["if"]
    assert security.excludes_pull_request(condition)
    assert f"github.ref == 'refs/heads/{RELEASE_BRANCH}'" in condition


def test_collate_dispatch_uses_matching_release_and_propagates_failure(tmp_path):
    job = load("maven-build-collate.yml")["jobs"]["maven-collate-ci"]
    resolve = next(s for s in job["steps"] if s.get("id") == "collate-ref")
    output = tmp_path / "output"
    result = subprocess.run(
        ["bash", "-c", resolve["run"]],
        env={
            **os.environ,
            "BASE_REF": f"refs/heads/{RELEASE_BRANCH}",
            "GITHUB_OUTPUT": str(output),
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert output.read_text().strip() == f"ref={RELEASE_BRANCH}"
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    gh = bin_dir / "gh"
    gh.write_text(
        '#!/bin/bash\nprintf "%s\\n" "$@" >> "$CALL_LOG"\nif [[ "$1" == "api" ]]; then echo 1234; else exit "$WATCH_STATUS"; fi\n'
    )
    gh.chmod(0o755)
    timeout = bin_dir / "timeout"
    timeout.write_text('#!/bin/bash\nshift\nexec "$@"\n')
    timeout.chmod(0o755)
    dispatch = next(
        s for s in job["steps"] if s.get("name") == "Trigger Collate build & wait"
    )
    log = tmp_path / "calls"
    env = {
        **os.environ,
        "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
        "CALL_LOG": str(log),
        "COLLATE_REPO": "org/private-repo",
        "COLLATE_REF": RELEASE_BRANCH,
        "SHA": "reviewed-sha",
        "EVENT": "push",
        "WAIT_SECONDS": "5",
    }
    for watch_status in (0, 1, 124):
        result = subprocess.run(
            ["bash", "-c", dispatch["run"]],
            env={**env, "WATCH_STATUS": str(watch_status)},
            capture_output=True,
            text=True,
        )
        assert result.returncode == watch_status, result.stderr
    calls = log.read_text()
    assert f"ref={RELEASE_BRANCH}" in calls
    assert "inputs[sha]=reviewed-sha" in calls


def test_required_checks_still_exist():
    required = {"py-tests-status"}
    if RELEASE_BRANCH == "1.13":
        required.update(
            {
                "checkstyle",
                "java-checkstyle",
                "py-checkstyle",
                "ui-checkstyle",
                "playwright-summary",
                "integration-tests-postgres-opensearch",
                "integration-tests-mysql-elasticsearch",
            }
        )
    jobs = {
        job_id
        for path in (ROOT / ".github/workflows").glob("*.y*ml")
        for job_id in load(path.name).get("jobs", {})
    }
    assert not required - jobs


@pytest.mark.skipif(
    RELEASE_BRANCH == "2.1", reason="Newer 2.1 uses the separate SSO nightly workflow"
)
@pytest.mark.parametrize("test_status", ["expected", "unexpected"])
def test_sso_summary_reports_results_without_pr_api_access(tmp_path, test_status):
    report_dir = tmp_path / "results/sso-results-json-mock-oidc"
    report_dir.mkdir(parents=True)
    (report_dir / "sso-results.json").write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "file": "auth.spec.ts",
                        "specs": [
                            {
                                "title": "login",
                                "tests": [
                                    {
                                        "status": test_status,
                                        "results": [
                                            {
                                                "status": "passed"
                                                if test_status == "expected"
                                                else "failed"
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        )
    )
    job = load("playwright-sso-tests.yml")["jobs"]["sso-summary"]
    step = next(s for s in job["steps"] if s.get("name") == "Write SSO test summary")
    script = re.sub(r"\$\{\{.*?\}\}", "123", step["with"]["script"])
    harness = (
        """
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let summary = ''; const failures = []; let apiAccesses = 0;
const core = {
  summary: { addRaw(text) { summary += text; return this; }, async write() {} },
  warning() {}, setFailed(message) { failures.push(message); }
};
const context = { payload: { pull_request: { number: 1, draft: false } }, repo: { owner: 'org', repo: 'repo' } };
const github = new Proxy({}, { get() { apiAccesses++; throw new Error('PR API access forbidden'); } });
await (async () => {
"""
        + script
        + "\n})();\nprocess.stdout.write(JSON.stringify({summary, failures, apiAccesses}));\n"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-"],
        input=harness,
        cwd=tmp_path,
        env={
            **os.environ,
            "SSO_TEST_RESULT": "success" if test_status == "expected" else "failure",
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    rendered = json.loads(result.stdout)
    assert rendered["apiAccesses"] == 0
    assert "SSO Playwright Results" in rendered["summary"]
    assert bool(rendered["failures"]) == (test_status == "unexpected")
