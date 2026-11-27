"""Exercise nightly workload selection and failure reports."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/ci-nightly.yml"
CONNECTORS = {
    "plan",
    "backend",
    "ingestion-image",
    "prepare-classification-models",
    "python-cli-e2e",
}
PYTHON = CONNECTORS | {
    "py-static-checks",
    "python-unit",
    "python-integration",
    "python-operator",
    "airflow-apis",
    "sonar-cloud-coverage-upload",
}
JAVA = {
    "integration-test-build",
    "it-mysql-elasticsearch",
    "it-postgres-opensearch",
    "it-postgres-elasticsearch-redis",
    "maven-sonarcloud-ci",
}


@pytest.fixture
def report(tmp_path):
    jobs = yaml.safe_load(WORKFLOW.read_text())["jobs"]
    needs = jobs["nightly-status"]["needs"]
    assert set(needs) == PYTHON | JAVA

    def invoke(workload, selected, outcomes=None, ref="refs/heads/main"):
        statuses = {
            name: "success" if name in selected else "skipped" for name in needs
        }
        statuses.update(outcomes or {})
        output = tmp_path / "output"
        summary = tmp_path / "summary"
        payload = tmp_path / "nightly-slack.json"
        result = subprocess.run(
            [sys.executable, str(ROOT / ".github/scripts/nightly_summary.py")],
            env={
                **os.environ,
                "NEEDS_JSON": json.dumps(
                    {name: {"result": status} for name, status in statuses.items()}
                ),
                "WORKLOAD": workload,
                "GITHUB_REF": ref,
                "GITHUB_REF_NAME": ref.removeprefix("refs/heads/"),
                "GITHUB_STEP_SUMMARY": str(summary),
                "GITHUB_OUTPUT": str(output),
                "GITHUB_SERVER_URL": "https://github.com",
                "GITHUB_REPOSITORY": "example/project",
                "GITHUB_RUN_ID": "123",
                "RUNNER_TEMP": str(tmp_path),
                "SLACK_CHANNEL": "test-channel",
                "PYTHON_ON_CALL": "test-on-call",
            },
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        return (
            output.read_text().strip(),
            summary.read_text(),
            json.loads(payload.read_text()) if payload.exists() else None,
        )

    return invoke


@pytest.mark.parametrize(
    ("workload", "selected", "ref"),
    [
        ("all", PYTHON | JAVA, "refs/heads/main"),
        ("python", PYTHON, "refs/heads/main"),
        ("java", JAVA, "refs/heads/main"),
        ("java", JAVA - {"maven-sonarcloud-ci"}, "refs/heads/example"),
        ("connectors", CONNECTORS, "refs/heads/main"),
    ],
)
def test_nightly_selected_workload_can_pass(report, workload, selected, ref):
    status, summary, payload = report(workload, selected, ref=ref)
    assert status == "failed=false"
    assert summary.count("| success |") == len(selected)
    assert payload is None


def test_nightly_slack_lists_failures_before_skipped_jobs(report):
    status, summary, payload = report(
        "all",
        PYTHON | JAVA,
        {
            "python-unit": "failure",
            "integration-test-build": "failure",
            "it-mysql-elasticsearch": "skipped",
            "it-postgres-opensearch": "skipped",
            "it-postgres-elasticsearch-redis": "skipped",
        },
    )
    assert status == "failed=true"
    assert "| Java integration runtime build | failure |" in summary
    text = [
        block["text"]["text"]
        for block in payload["blocks"]
        if block["type"] == "section"
    ]
    assert text[0].splitlines() == [
        "*Failed*",
        "• Python unit tests",
        "• Java integration runtime build",
    ]
    assert text[1].splitlines() == [
        "*Did not complete*",
        "• Java integration tests (MySQL + Elasticsearch) — skipped",
        "• Java integration tests (PostgreSQL + OpenSearch) — skipped",
        "• Java integration tests (PostgreSQL + Elasticsearch + Redis) — skipped",
    ]
    assert "https://github.com/example/project/actions/runs/123" in text[2]
    assert "test-on-call" in text[2]


def test_java_only_failure_does_not_page_python_on_call(report):
    status, summary, payload = report("java", JAVA, {"maven-sonarcloud-ci": "failure"})
    assert status == "failed=true"
    assert "Java Sonar analysis" in payload["text"]
    assert "test-on-call" not in json.dumps(payload)
    assert "Python workload selection" not in summary


def test_unexpected_skip_fails_even_when_no_job_reports_failure(report):
    status, summary, payload = report(
        "connectors", CONNECTORS, {"python-cli-e2e": "skipped"}
    )
    assert status == "failed=true"
    assert "| Connector CLI E2E tests | skipped |" in summary
    assert "Connector CLI E2E tests — skipped" in payload["text"]
