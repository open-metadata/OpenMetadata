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

"""Summarize nightly job results and prepare a Slack alert for failures."""

import json
import os
from pathlib import Path

CONNECTOR_JOBS = {
    "plan": "Python workload selection",
    "backend": "Backend image build",
    "ingestion-image": "Ingestion image build",
    "prepare-classification-models": "Classification models",
    "python-cli-e2e": "Connector CLI E2E tests",
}
PYTHON_JOBS = {
    "py-static-checks": "Python static checks",
    "python-unit": "Python unit tests",
    "python-integration": "Python integration tests",
    "python-operator": "Ingestion operator image smoke test",
    "airflow-apis": "Airflow API tests",
    "sonar-cloud-coverage-upload": "Python and Airflow Sonar analysis",
}
JAVA_JOBS = {
    "integration-test-build": "Java integration runtime build",
    "it-mysql-elasticsearch": "Java integration tests (MySQL + Elasticsearch)",
    "it-postgres-opensearch": "Java integration tests (PostgreSQL + OpenSearch)",
    "it-postgres-elasticsearch-redis": "Java integration tests (PostgreSQL + Elasticsearch + Redis)",
    "maven-sonarcloud-ci": "Java Sonar analysis",
}
JOB_LABELS = {**CONNECTOR_JOBS, **PYTHON_JOBS, **JAVA_JOBS}


def expected_jobs(workload: str, ref: str, results: dict[str, str]) -> set[str]:
    """Return the jobs that must report success for the selected workload."""
    expected = set()
    if workload in {"all", "python", "connectors"}:
        expected.update(CONNECTOR_JOBS)
    if workload in {"all", "python"}:
        expected.update(PYTHON_JOBS)
        # The upload waits for a usable Airflow or ingestion result.
        if ref != "refs/heads/main" or (
            results["airflow-apis"] != "success"
            and results["python-unit"] not in {"success", "failure"}
        ):
            expected.remove("sonar-cloud-coverage-upload")
    if workload in {"all", "java"}:
        expected.update(JAVA_JOBS)
        if ref != "refs/heads/main":
            expected.remove("maven-sonarcloud-ci")
    if not expected:
        raise ValueError(f"Unknown nightly workload: {workload}")
    return expected


def main() -> None:
    needs = json.loads(os.environ["NEEDS_JSON"])
    workload = os.environ["WORKLOAD"]
    results = {
        name: needs.get(name, {}).get("result") or "missing" for name in JOB_LABELS
    }
    expected = expected_jobs(workload, os.environ["GITHUB_REF"], results)
    summary = {
        name: result
        for name, result in results.items()
        if name in expected or result not in {"skipped", "missing"}
    }
    issues = {name: result for name, result in summary.items() if result != "success"}
    heading = "Backend nightly failed" if issues else "Backend nightly passed"
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as output:
        output.write(f"### {heading}\n\nWorkload: `{workload}`\n\n")
        output.write("| Job | Result |\n| --- | --- |\n")
        for name, result in summary.items():
            output.write(f"| {JOB_LABELS[name]} | {result} |\n")
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        output.write(f"failed={str(bool(issues)).lower()}\n")
    if not issues:
        return

    run_url = (
        f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}"
        f"/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    )
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"❌ {heading}"}},
        {
            "type": "context",
            "elements": [
                {
                    "type": "plain_text",
                    "text": f"Workload: {workload} · Ref: {os.environ['GITHUB_REF_NAME']}",
                }
            ],
        },
    ]
    failed = [
        JOB_LABELS[name] for name, result in issues.items() if result == "failure"
    ]
    incomplete = [
        f"{JOB_LABELS[name]} — {result}"
        for name, result in issues.items()
        if result != "failure"
    ]
    for label, jobs in (("Failed", failed), ("Did not complete", incomplete)):
        if jobs:
            blocks.append(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*{label}*\n" + "\n".join(f"• {job}" for job in jobs),
                    },
                }
            )
    link = f"<{run_url}|Open GitHub Actions run>"
    if issues.keys() & (CONNECTOR_JOBS.keys() | PYTHON_JOBS.keys()):
        link += f" · {os.environ['PYTHON_ON_CALL']}"
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": link}})
    payload = {
        "channel": os.environ["SLACK_CHANNEL"],
        "text": f"{heading} — {', '.join(failed + incomplete)}\n{run_url}",
        "blocks": blocks,
        "unfurl_links": False,
        "unfurl_media": False,
    }
    (Path(os.environ["RUNNER_TEMP"]) / "nightly-slack.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
