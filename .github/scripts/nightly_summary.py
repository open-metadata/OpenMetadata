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

"""Summarize nightly job results and prepare one Slack alert per owning team."""

import json
import os
from dataclasses import dataclass
from pathlib import Path

CONNECTOR_RUNS = frozenset({"all", "python", "connectors"})
PYTHON_RUNS = frozenset({"all", "python"})
JAVA_RUNS = frozenset({"all", "java"})
BLOCKING_RESULTS = frozenset({"failure", "cancelled"})


@dataclass(frozen=True)
class Team:
    channel: str
    mention: str


@dataclass(frozen=True)
class Job:
    label: str
    team: str
    workloads: frozenset[str]
    after: frozenset[str] = frozenset()
    mentions: bool = True


TEAMS = {
    "ingestion": Team(channel="C03EYBDDX17", mention="<!subteam^S0AH093PEQL>"),
    "platform": Team(channel="C0AC5T013V1", mention="<!subteam^S0AH9J9UQ2V>"),
}

# Each job names its owning team and the jobs it waits for (its `needs` in ci-nightly.yml).
# A failure alerts the owner of the job that failed; the jobs it skipped are listed in that alert.
JOBS = {
    "plan": Job("Python workload selection", "ingestion", CONNECTOR_RUNS),
    "backend": Job(
        "Backend image build", "platform", CONNECTOR_RUNS, frozenset({"plan"})
    ),
    "ingestion-image": Job(
        "Ingestion image build", "ingestion", CONNECTOR_RUNS, frozenset({"plan"})
    ),
    "prepare-classification-models": Job(
        "Classification models", "ingestion", CONNECTOR_RUNS, frozenset({"plan"})
    ),
    "python-cli-e2e": Job(
        "Connector CLI E2E tests",
        "ingestion",
        CONNECTOR_RUNS,
        frozenset(
            {"plan", "prepare-classification-models", "backend", "ingestion-image"}
        ),
    ),
    "py-static-checks": Job(
        "Python static checks", "ingestion", PYTHON_RUNS, frozenset({"plan"})
    ),
    "python-unit": Job(
        "Python unit tests",
        "ingestion",
        PYTHON_RUNS,
        frozenset({"plan", "prepare-classification-models"}),
    ),
    "python-integration": Job(
        "Python integration tests",
        "ingestion",
        PYTHON_RUNS,
        frozenset({"plan", "prepare-classification-models", "backend"}),
    ),
    "python-operator": Job(
        "Ingestion operator image smoke test",
        "ingestion",
        PYTHON_RUNS,
        frozenset({"plan", "backend", "ingestion-image"}),
    ),
    "airflow-apis": Job(
        "Airflow API tests", "ingestion", PYTHON_RUNS, frozenset({"plan", "backend"})
    ),
    "sonar-cloud-coverage-upload": Job(
        "Python and Airflow Sonar analysis",
        "ingestion",
        PYTHON_RUNS,
        frozenset(
            {
                "plan",
                "airflow-apis",
                "python-unit",
                "python-integration",
                "python-cli-e2e",
            }
        ),
    ),
    "integration-test-build": Job(
        "Java integration runtime build", "platform", JAVA_RUNS
    ),
    "it-mysql-elasticsearch": Job(
        "Java integration tests (MySQL + Elasticsearch)",
        "platform",
        JAVA_RUNS,
        frozenset({"integration-test-build"}),
    ),
    # Sonar results are reported to the team but do not need someone the same morning.
    "maven-sonarcloud-ci": Job(
        "Java Sonar analysis", "platform", JAVA_RUNS, mentions=False
    ),
}


def expected_jobs(workload: str, ref: str, results: dict[str, str]) -> set[str]:
    """Return the jobs that must report success for the selected workload."""
    expected = {name for name, job in JOBS.items() if workload in job.workloads}
    if not expected:
        raise ValueError(f"Unknown nightly workload: {workload}")
    # The upload waits for a usable Airflow or ingestion result.
    if "sonar-cloud-coverage-upload" in expected and (
        ref != "refs/heads/main"
        or (
            results["airflow-apis"] != "success"
            and results["python-unit"] not in {"success", "failure"}
        )
    ):
        expected.remove("sonar-cloud-coverage-upload")
    if ref != "refs/heads/main":
        expected.discard("maven-sonarcloud-ci")
    return expected


def blockers(name: str, results: dict[str, str]) -> set[str]:
    """Return the failed or cancelled upstream jobs that kept a job from running."""
    found = set()
    for parent in JOBS[name].after:
        if results[parent] in BLOCKING_RESULTS:
            found.add(parent)
        elif results[parent] == "skipped":
            found |= blockers(parent, results)
    return found


def route(issues: dict[str, str], results: dict[str, str]) -> dict[str, dict]:
    """Group the unsuccessful jobs by the team that owns what went wrong."""
    alerts = {}

    def alert(team: str) -> dict:
        return alerts.setdefault(
            team, {"failed": [], "incomplete": [], "not_run": [], "mention": False}
        )

    for name, result in issues.items():
        job = JOBS[name]
        causes = blockers(name, results) if result == "skipped" else set()
        for cause in sorted(causes):
            alert(JOBS[cause].team)["not_run"].append(
                f"{job.label} (after {JOBS[cause].label})"
            )
        if causes:
            continue
        own = alert(job.team)
        if result == "failure":
            own["failed"].append(job.label)
        else:
            own["incomplete"].append(f"{job.label} ({result})")
        own["mention"] = own["mention"] or job.mentions
    return alerts


def slack_payload(
    team: Team, alert: dict, heading: str, context: str, run_url: str
) -> dict:
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"❌ {heading}"}},
        {"type": "context", "elements": [{"type": "plain_text", "text": context}]},
    ]
    sections = (
        ("Failed", alert["failed"]),
        ("Did not complete", alert["incomplete"]),
        ("Did not run", alert["not_run"]),
    )
    for label, jobs in sections:
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
    if alert["mention"]:
        link += f" · {team.mention}"
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": link}})
    listed = alert["failed"] + alert["incomplete"] + alert["not_run"]
    return {
        "channel": team.channel,
        "text": f"{heading}: {', '.join(listed)}\n{run_url}",
        "blocks": blocks,
        "unfurl_links": False,
        "unfurl_media": False,
    }


def main() -> None:
    needs = json.loads(os.environ["NEEDS_JSON"])
    workload = os.environ["WORKLOAD"]
    results = {name: needs.get(name, {}).get("result") or "missing" for name in JOBS}
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
            output.write(f"| {JOBS[name].label} | {result} |\n")

    run_url = (
        f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}"
        f"/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    )
    context = f"Workload: {workload} · Ref: {os.environ['GITHUB_REF_NAME']}"
    outputs = [f"failed={str(bool(issues)).lower()}"]
    for team_name, alert in route(issues, results).items():
        payload = slack_payload(TEAMS[team_name], alert, heading, context, run_url)
        path = Path(os.environ["RUNNER_TEMP"]) / f"nightly-slack-{team_name}.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        outputs.append(f"slack_{team_name}={path}")
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        output.write("\n".join(outputs) + "\n")


if __name__ == "__main__":
    main()
