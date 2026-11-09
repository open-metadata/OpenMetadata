#!/usr/bin/env python3
"""Record Java test evidence and compare dequeued checks with their exact main base.

ADR:2026-11-06-dequeue-attribution-requires-comparable-test-evidence
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path

import merge_queue_metrics as mq

MAX_EVIDENCE_BYTES = 16 * 1024 * 1024


@dataclass(frozen=True)
class Evidence:
    version: int
    sha: str
    base_sha: str
    job: str
    suite: str
    runner: list[str]
    tests: dict[str, str]


def failure_fingerprint(failure: ET.Element) -> str:
    message = (
        failure.get("message") or failure.findtext("stackTrace") or failure.text or ""
    ).strip()
    if not message:
        raise ValueError("test failure has no diagnostic message")
    signature = " ".join(f"{failure.get('type', '')} {message}".split())
    return "failed:" + hashlib.sha256(signature.encode()).hexdigest()


def read_tests(paths: list[Path]) -> dict[str, str]:
    tests: dict[str, str] = {}
    for path in paths:
        for case in ET.parse(path).iter("testcase"):
            if not case.get("classname") or not case.get("name"):
                raise ValueError("test case is missing its class or method name")
            name = f"{case.get('classname', '')}#{case.get('name', '')}"
            failures = {
                failure_fingerprint(item)
                for item in case
                if item.tag in {"failure", "error", "rerunFailure", "rerunError"}
            }
            result = next(iter(failures)) if failures else "passed"
            if case.find("skipped") is not None:
                result = "skipped" if not failures else "unstable"
            if len(failures) > 1 or any(
                case.find(tag) is not None for tag in ("flakyFailure", "flakyError")
            ):
                result = "unstable"
            previous = tests.get(name)
            tests[name] = result if previous in (None, result) else "unstable"
    return tests


def checkout_sha(path: Path) -> str:
    if not (path / ".git").exists():
        return ""
    return subprocess.run(
        ["git", "-C", str(path), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def record(args: argparse.Namespace) -> None:
    event = json.loads(
        Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8")
    )
    paths = sorted(
        {path for pattern in args.reports.splitlines() for path in Path().glob(pattern)}
    )
    evidence = Evidence(
        version=1,
        sha=checkout_sha(Path()),
        base_sha=event.get("merge_group", {}).get("base_sha", os.environ["GITHUB_SHA"]),
        job=args.job,
        suite=args.suite,
        runner=[os.environ["RUNNER_OS"], os.environ["RUNNER_ARCH"]],
        tests=read_tests(paths),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(asdict(evidence)), encoding="utf-8")


def parse_evidence(data: dict, sha: str, job: str) -> Evidence:
    if not isinstance(data, dict) or set(data) != set(Evidence.__dataclass_fields__):
        raise ValueError("invalid test evidence fields")
    if data["version"] != 1 or data["sha"] != sha or data["job"] != job:
        raise ValueError("test evidence does not match this run and job")
    if not isinstance(data["base_sha"], str) or not re.fullmatch(
        r"[0-9a-f]{40}", data["base_sha"]
    ):
        raise ValueError("test evidence is missing its base commit revision")
    if (
        not isinstance(data["suite"], str)
        or not data["suite"]
        or not isinstance(data["runner"], list)
        or len(data["runner"]) != 2
        or not all(isinstance(value, str) and value for value in data["runner"])
    ):
        raise ValueError("test evidence is missing its suite or runner")
    if not isinstance(data["tests"], dict) or not all(
        isinstance(name, str)
        and isinstance(result, str)
        and (
            result in {"passed", "skipped", "unstable"}
            or re.fullmatch(r"failed:[0-9a-f]{64}", result)
        )
        for name, result in data["tests"].items()
    ):
        raise ValueError("invalid test results")
    return Evidence(**data)


def load_evidence(repo: str, run: dict, job: str, token: str) -> Evidence | None:
    name = f"ci-test-evidence-{job}-{run['run_attempt']}"
    artifacts = mq.paginated_items(
        f"/repos/{repo}/actions/runs/{run['id']}/artifacts", "artifacts", token
    )
    artifact = next(
        (item for item in artifacts if item["name"] == name and not item["expired"]),
        None,
    )
    if artifact is None:
        return None
    if artifact["size_in_bytes"] > MAX_EVIDENCE_BYTES:
        raise ValueError("test evidence archive is too large")
    archive = subprocess.run(
        ["gh", "api", f"repos/{repo}/actions/artifacts/{artifact['id']}/zip"],
        check=True,
        capture_output=True,
        timeout=60,
    ).stdout
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        if bundle.getinfo("evidence.json").file_size > MAX_EVIDENCE_BYTES:
            raise ValueError("test evidence JSON is too large")
        data = json.loads(bundle.read("evidence.json"))
    return parse_evidence(data, sha=run["head_sha"], job=job)


def compare_tests(candidate: Evidence, baseline: Evidence) -> str:
    if "unstable" in candidate.tests.values():
        return "Unknown: test retries have conflicting outcomes."
    failures = {
        name: result
        for name, result in candidate.tests.items()
        if result.startswith("failed:")
    }
    if not failures:
        return (
            "Unknown: no failed test cases were recorded; inspect the failing job step."
        )
    existing = sum(
        baseline.tests.get(name) == result for name, result in failures.items()
    )
    new = sum(baseline.tests.get(name) == "passed" for name in failures)
    unknown = len(failures) - existing - new
    counts = f"{new} passed on main, {existing} have the same failure on main, {unknown} unconfirmed"
    if new:
        return f"Possible PR/merge-group regression: {counts}."
    if unknown:
        return f"Unknown: {counts}."
    return f"Also failing on main: {existing} matching test failure(s)."


def compare_job(
    repo: str, sha: str, url: str, name: str, branch: str, token: str
) -> str:
    match = re.search(r"/actions/runs/(\d+)/job/(\d+)$", url)
    if match is None:
        return "Unknown: no Actions job reference."
    run_id, job_id = match.groups()
    run = mq.rest(f"/repos/{repo}/actions/runs/{run_id}", token)
    jobs = mq.paginated_items(
        f"/repos/{repo}/actions/runs/{run_id}/attempts/{run['run_attempt']}/jobs",
        "jobs",
        token,
    )
    job = next(
        (job for job in jobs if str(job["id"]) == job_id and job["name"] == name), None
    )
    if run["head_sha"] != sha or run["event"] != "merge_group" or job is None:
        return "Unknown: the failed check is not from the current queue-run attempt."
    if job["conclusion"] != "failure":
        return f"Unknown: job conclusion is {job['conclusion'] or 'pending'}; test attribution is unavailable."
    candidate = load_evidence(repo, run, name, token)
    if candidate is None:
        return "Unknown: no test evidence for this job (missing, expired, or not yet uploaded)."
    runs = mq.paginated_items(
        f"/repos/{repo}/actions/workflows/{run['workflow_id']}/runs?head_sha={candidate.base_sha}&branch={branch}&status=completed",
        "workflow_runs",
        token,
    )
    for baseline_run in runs:
        if baseline_run["event"] not in {"push", "workflow_dispatch"} or baseline_run[
            "conclusion"
        ] not in {"success", "failure"}:
            continue
        baseline_jobs = mq.paginated_items(
            f"/repos/{repo}/actions/runs/{baseline_run['id']}/attempts/{baseline_run['run_attempt']}/jobs",
            "jobs",
            token,
        )
        if not any(
            job["name"] == name and job["conclusion"] in {"success", "failure"}
            for job in baseline_jobs
        ):
            continue
        baseline = load_evidence(repo, baseline_run, name, token)
        if baseline is None or baseline.sha != candidate.base_sha:
            continue
        if (candidate.suite, candidate.runner) != (
            baseline.suite,
            baseline.runner,
        ):
            continue
        return (
            f"{compare_tests(candidate, baseline)} Baseline: {baseline_run['html_url']}"
        )
    return f"Unknown: no executed baseline with matching suite and runner at main {candidate.base_sha[:7]}."


def report(args: argparse.Namespace) -> None:
    token = mq.env_token()
    failures = args.failures.read_text(encoding="utf-8").splitlines()
    attributions: list[tuple[str, str]] = []
    if not failures:
        attributions.append(
            ("", "Unknown: no completed failing Actions job to compare.")
        )
    for failure in failures:
        url, separator, name = failure.partition("\t")
        if not separator:
            attributions.append(("", "Unknown: malformed Actions job reference."))
            continue
        try:
            reason = compare_job(args.repo, args.sha, url, name, args.branch, token)
        except Exception as exc:
            # Attribution is auxiliary; a failed comparison must not suppress the report.
            print(
                f"::warning::Could not compare dequeue evidence: {type(exc).__name__}: {' '.join(str(exc).split())}",
                file=sys.stderr,
            )
            reason = "Unknown: baseline evidence could not be read."
        attributions.append((" ".join(name.split()), reason))

    markdown, slack = [], []
    for name, reason in attributions:
        delimiter = "`" * (
            max((len(run) for run in re.findall(r"`+", name)), default=0) + 1
        )
        markdown_name = f"{delimiter} {name} {delimiter}: " if name else ""
        slack_name = f"{mq.sanitize_external(name)}: " if name else ""
        markdown.append(f"Attribution: {markdown_name}{reason}")
        slack.append(f"Attribution: {slack_name}{reason}")
    print(json.dumps({"markdown": "\n".join(markdown), "slack": "\n".join(slack)}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture = commands.add_parser("record")
    capture.add_argument("--job", required=True)
    capture.add_argument("--suite", required=True)
    capture.add_argument("--reports", required=True)
    capture.add_argument("--output", type=Path, required=True)
    compare = commands.add_parser("compare")
    compare.add_argument("--repo", required=True)
    compare.add_argument("--sha", required=True)
    compare.add_argument("--branch", required=True)
    compare.add_argument("--failures", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "record":
        record(args)
    else:
        report(args)


if __name__ == "__main__":
    main()
