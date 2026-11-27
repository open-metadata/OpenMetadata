"""Exercise nightly workload selection and failure reports."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / ".github/scripts/nightly_summary.py"
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
JAVA_SETUPS = (
    "it-mysql-elasticsearch",
    "it-postgres-opensearch",
    "it-postgres-elasticsearch-redis",
)
JAVA = {"integration-test-build", *JAVA_SETUPS, "maven-sonarcloud-ci"}
INGESTION_ON_DUTY = "<!subteam^S0AH093PEQL>"
PLATFORM_ON_DUTY = "<!subteam^S0AH9J9UQ2V>"


def load_summary():
    spec = importlib.util.spec_from_file_location("nightly_summary", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["nightly_summary"] = module
    spec.loader.exec_module(module)
    return module


def workflow_jobs():
    return yaml.safe_load(WORKFLOW.read_text())["jobs"]


def sections(payload):
    return {
        block["text"]["text"].splitlines()[0]: block["text"]["text"].splitlines()[1:]
        for block in payload["blocks"]
        if block["type"] == "section" and block["text"]["text"].startswith("*")
    }


@pytest.fixture
def report(tmp_path):
    needs = workflow_jobs()["nightly-status"]["needs"]
    assert set(needs) == PYTHON | JAVA

    def invoke(workload, selected, outcomes=None, ref="refs/heads/main"):
        statuses = {
            name: "success" if name in selected else "skipped" for name in needs
        }
        statuses.update(outcomes or {})
        output = tmp_path / "output"
        summary = tmp_path / "summary"
        result = subprocess.run(
            [sys.executable, str(SCRIPT)],
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
            },
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        outputs = dict(
            line.split("=", 1) for line in output.read_text().splitlines() if line
        )
        payloads = {
            name.removeprefix("slack_"): json.loads(Path(path).read_text())
            for name, path in outputs.items()
            if name.startswith("slack_")
        }
        return outputs["failed"], summary.read_text(), payloads

    return invoke


def test_every_nightly_job_has_an_owner_and_its_workflow_needs():
    summary = load_summary()
    jobs = workflow_jobs()
    assert set(summary.JOBS) == set(jobs["nightly-status"]["needs"])
    for name, job in summary.JOBS.items():
        needs = jobs[name].get("needs", [])
        assert job.after == set([needs] if isinstance(needs, str) else needs), name
        assert job.team in summary.TEAMS, name


def test_every_team_has_a_slack_step():
    steps = workflow_jobs()["nightly-status"]["steps"]
    paths = {step.get("with", {}).get("payload-file-path") for step in steps}
    for team in load_summary().TEAMS:
        assert f"${{{{ steps.summary.outputs.slack_{team} }}}}" in paths, team


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
    status, summary, payloads = report(workload, selected, ref=ref)
    assert status == "false"
    assert summary.count("| success |") == len(selected)
    assert payloads == {}


def test_python_failure_alerts_ingestion_only(report):
    status, summary, payloads = report("all", PYTHON | JAVA, {"python-unit": "failure"})
    assert status == "true"
    assert "| Python unit tests | failure |" in summary
    assert set(payloads) == {"ingestion"}
    payload = payloads["ingestion"]
    assert payload["channel"] == "C03EYBDDX17"
    assert sections(payload) == {"*Failed*": ["• Python unit tests"]}
    assert "https://github.com/example/project/actions/runs/123" in payload["text"]
    assert INGESTION_ON_DUTY in json.dumps(payload)


def test_java_failure_alerts_platform_and_lists_skipped_jobs(report):
    status, summary, payloads = report(
        "java",
        JAVA,
        {
            "integration-test-build": "failure",
            **dict.fromkeys(JAVA_SETUPS, "skipped"),
        },
    )
    assert status == "true"
    assert "| Java integration runtime build | failure |" in summary
    assert set(payloads) == {"platform"}
    payload = payloads["platform"]
    assert payload["channel"] == "C0AC5T013V1"
    after = " (after Java integration runtime build)"
    assert sections(payload) == {
        "*Failed*": ["• Java integration runtime build"],
        "*Did not run*": [
            f"• Java integration tests (MySQL + Elasticsearch){after}",
            f"• Java integration tests (PostgreSQL + OpenSearch){after}",
            f"• Java integration tests (PostgreSQL + Elasticsearch + Redis){after}",
        ],
    }
    assert PLATFORM_ON_DUTY in json.dumps(payload)
    assert INGESTION_ON_DUTY not in json.dumps(payload)


def test_backend_failure_alerts_platform_for_the_python_jobs_it_skipped(report):
    skipped = [
        "python-integration",
        "python-cli-e2e",
        "python-operator",
        "airflow-apis",
    ]
    status, _, payloads = report(
        "python",
        PYTHON,
        {"backend": "failure", **dict.fromkeys(skipped, "skipped")},
    )
    assert status == "true"
    assert set(payloads) == {"platform"}
    listed = sections(payloads["platform"])
    assert listed["*Failed*"] == ["• Backend image build"]
    assert len(listed["*Did not run*"]) == len(skipped)
    assert all("(after Backend image build)" in job for job in listed["*Did not run*"])
    assert PLATFORM_ON_DUTY in json.dumps(payloads["platform"])


def test_java_sonar_failure_is_reported_without_a_mention(report):
    status, summary, payloads = report("java", JAVA, {"maven-sonarcloud-ci": "failure"})
    assert status == "true"
    assert set(payloads) == {"platform"}
    assert "Java Sonar analysis" in payloads["platform"]["text"]
    assert "subteam" not in json.dumps(payloads["platform"])
    assert "Python workload selection" not in summary


def test_failures_in_both_teams_alert_each_team(report):
    status, _, payloads = report(
        "all",
        PYTHON | JAVA,
        {"python-unit": "failure", "it-mysql-elasticsearch": "failure"},
    )
    assert status == "true"
    assert sections(payloads["ingestion"]) == {"*Failed*": ["• Python unit tests"]}
    assert INGESTION_ON_DUTY in json.dumps(payloads["ingestion"])
    assert sections(payloads["platform"]) == {
        "*Failed*": ["• Java integration tests (MySQL + Elasticsearch)"]
    }
    assert PLATFORM_ON_DUTY in json.dumps(payloads["platform"])


def test_unexpected_skip_alerts_the_owner_of_the_skipped_job(report):
    status, summary, payloads = report(
        "connectors", CONNECTORS, {"python-cli-e2e": "skipped"}
    )
    assert status == "true"
    assert "| Connector CLI E2E tests | skipped |" in summary
    assert set(payloads) == {"ingestion"}
    assert sections(payloads["ingestion"]) == {
        "*Did not complete*": ["• Connector CLI E2E tests (skipped)"]
    }
    assert INGESTION_ON_DUTY in json.dumps(payloads["ingestion"])
