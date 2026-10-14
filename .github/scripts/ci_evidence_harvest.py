#!/usr/bin/env python3
"""Archive merge-queue failure evidence before GitHub expires it.

The merge-gate replay and the AI backtest need, for each failed merge-group run
attempt, which jobs failed, at which step, why, and which tests failed with what
message. Run and job data outlive the artifacts that name the failing tests:
Playwright results JSON is kept 3 days, Java IT diagnostics 7 days and Python
results 14 days. Running this daily keeps a complete record until the merge gate
writes its own.

Only small evidence is kept: each lane's outcome.json, the failsafe report of a
failing class, and the failed and flaky tests read from Playwright results.
Distributions, images, blob reports and logs are never downloaded. Archives are
shaped by the code under test, so members are size-capped, parsed only as data,
and written under names this script chooses.

Earlier attempts of re-run runs are archived too: a failed attempt followed by a
green one on the same commit is the strongest flake evidence the queue produces.

Exits:
  0 — every selected attempt is archived (or already was)
  1 — the runs could not be listed (bad token, API down)
  2 — some attempts were only partly read; the next run retries them
"""

from __future__ import annotations

import argparse
import json
import re
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import merge_queue_metrics as mq
import playwright_flaky_report as pfr
from merge_gate_evidence import (
    MAX_ARTIFACT_BYTES,
    first_failed_step,
    member_bytes,
    outcomes_from_archive,
    playwright_tests,
    read_zip,
)

SCHEMA_VERSION = 1
# The runs API returns at most 1,000 results per filtered query; a busy queue
# creates ~1,600 merge-group runs a day, so the window is listed in slices.
LIST_SLICE = timedelta(hours=6)
MIN_LIST_SLICE = timedelta(minutes=30)
LIST_MAX_PAGES = 10
MAX_FAILED_JOBS = 30
FAILED = {"failure", "timed_out"}

QUEUE_REF = re.compile(r"pr-(?P<pr>\d+)-(?P<base>[0-9a-f]{40})")
JAVA_LANE_JOB = re.compile(r"^Integration Test Lane \((?P<lane>[^)]+)\)$")
PYTHON_RESULTS = re.compile(r"^py-(?:integration|unit)-test-results-")
UNSAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


class Budget:
    """Download allowance shared by the worker threads."""

    def __init__(self, limit_bytes: int):
        self.limit = limit_bytes
        self.used = 0
        self._lock = threading.Lock()

    def take(self, size: int) -> bool:
        with self._lock:
            if self.used + size > self.limit:
                return False
            self.used += size
            return True


def suite_of(run: dict) -> str:
    path = run.get("path") or ""
    if "integration-tests-" in path:
        return "java-it"
    if "/py-tests" in path:
        return "python"
    if path.endswith("/" + pfr.WORKFLOW):
        return "playwright"
    return "other"


def safe_name(value: str) -> str:
    return UNSAFE_NAME.sub("_", value)[:120] or "_"


def job_summary(job: dict) -> dict:
    return {
        "id": job["id"],
        "name": job["name"],
        "conclusion": job.get("conclusion"),
        "failedStep": first_failed_step(job),
        "startedAt": job.get("started_at"),
        "completedAt": job.get("completed_at"),
        "url": job.get("html_url"),
    }


def java_lane_artifacts(
    artifacts: list[dict], failed_jobs: list[dict], run_id: int, attempt: int
) -> tuple[list[dict], list[str]]:
    """The per-lane diagnostics artifact of every failed lane job, and the lanes with none."""
    lanes = [
        match["lane"]
        for job in failed_jobs
        if (match := JAVA_LANE_JOB.match(job["name"]))
    ]
    picked, missing = [], []
    for lane in lanes:
        suffix = f"-{lane}-{run_id}-{attempt}"
        found = [
            artifact
            for artifact in artifacts
            if artifact["name"].startswith("java-it-")
            and not artifact["name"].startswith(("java-it-reports-", "java-it-build-"))
            and artifact["name"].endswith(suffix)
        ]
        if found:
            picked.append(found[0])
        else:
            missing.append(f"no diagnostics artifact for lane {lane}")
    return picked, missing


def python_artifacts(artifacts: list[dict]) -> list[dict]:
    # Python result artifacts carry no attempt suffix, so a re-run overwrites them;
    # the outcome's own context.runAttempt is checked when they are read.
    return [a for a in artifacts if PYTHON_RESULTS.match(a["name"])]


def outcome_record(artifact_name: str, outcome: dict) -> dict:
    return {
        "artifact": artifact_name,
        "classification": outcome.get("classification"),
        "context": outcome.get("context"),
        "exitCode": outcome.get("exitCode"),
        "stepOutcome": outcome.get("stepOutcome"),
        "reasons": outcome.get("reasons"),
        "tests": outcome.get("tests"),
        "failedTests": outcome.get("failedTests") or [],
        "flakyTests": outcome.get("flakyTests") or [],
    }


def list_attempts(owner: str, repo: str, run: dict, token: str) -> list[tuple[int, str | None]]:
    """(attempt, conclusion of the latest attempt) for every failed attempt of a run."""
    latest = int(run.get("run_attempt") or 1)
    selected = []
    if run.get("conclusion") in FAILED:
        selected.append((latest, None))
    for attempt in range(1, latest):
        data = mq.rest(
            f"/repos/{owner}/{repo}/actions/runs/{run['id']}/attempts/{attempt}", token
        )
        if data.get("conclusion") in FAILED:
            selected.append((attempt, run.get("conclusion")))
    return selected


def list_slice(
    owner: str, repo: str, start: datetime, end: datetime, token: str
) -> list[dict]:
    stamp = "%Y-%m-%dT%H:%M:%SZ"
    query = urlencode(
        {
            "event": "merge_group",
            "status": "completed",
            "created": f"{start.astimezone(timezone.utc):{stamp}}..{end.astimezone(timezone.utc):{stamp}}",
        }
    )
    try:
        return mq.paginated_items(
            f"/repos/{owner}/{repo}/actions/runs?{query}",
            "workflow_runs",
            token,
            max_pages=LIST_MAX_PAGES,
        )
    except mq.ApiError as exc:
        # Over 1,000 runs in the slice: halve it rather than silently drop the rest.
        if "Partial data" not in str(exc) or end - start <= MIN_LIST_SLICE:
            raise
        middle = start + (end - start) / 2
        return list_slice(owner, repo, start, middle, token) + list_slice(
            owner, repo, middle, end, token
        )


def list_runs(
    owner: str, repo: str, since: datetime, until: datetime, token: str, workers: int = 6
) -> list[dict]:
    slices = []
    start = since
    while start < until:
        end = min(start + LIST_SLICE, until)
        slices.append((start, end))
        start = end
    # A filtered runs page takes seconds to serve, so 14 days read one slice at a time
    # spends many minutes listing while the oldest artifacts expire.
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        pages = list(
            pool.map(lambda bounds: list_slice(owner, repo, *bounds, token), slices)
        )
    # `created=a..b` includes both ends, so neighbouring slices can both return a run
    # created on their shared second; keying by id reads it once.
    runs: dict[int, dict] = {}
    for page in pages:
        for run in page:
            runs[run["id"]] = run
    return list(runs.values())


def record_path(out: Path, run_id: int, attempt: int) -> Path:
    return out / "runs" / f"{run_id}-a{attempt}" / "record.json"


def harvest_attempt(
    owner: str,
    repo: str,
    run: dict,
    attempt: int,
    later_conclusion: str | None,
    token: str,
    budget: Budget,
    out: Path,
) -> dict:
    ref = QUEUE_REF.search(run.get("head_branch") or "")
    record: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "runId": run["id"],
        "attempt": attempt,
        "laterAttemptConclusion": later_conclusion,
        "workflow": run.get("name"),
        "workflowPath": run.get("path"),
        "suite": suite_of(run),
        "headBranch": run.get("head_branch"),
        "headSha": run.get("head_sha"),
        "prNumber": int(ref["pr"]) if ref else None,
        "baseSha": ref["base"] if ref else None,
        "createdAt": run.get("created_at"),
        "url": run.get("html_url"),
        "jobs": [],
        "outcomes": [],
        "playwright": None,
        "missingEvidence": [],
        "complete": False,
    }
    files_dir = record_path(out, run["id"], attempt).parent / "files"
    attempt_run = {**run, "run_attempt": attempt}

    jobs = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/attempts/{attempt}/jobs",
        "jobs",
        token,
    )
    failed_jobs = [job for job in jobs if job.get("conclusion") in FAILED]
    if len(failed_jobs) > MAX_FAILED_JOBS:
        record["missingEvidence"].append(
            f"{len(failed_jobs) - MAX_FAILED_JOBS} failed jobs not detailed"
        )
    detailed = failed_jobs[:MAX_FAILED_JOBS]
    reasons = {
        reason["url"]: reason["reason"]
        for reason in pfr.job_reasons(owner, repo, detailed, token)
    }
    record["jobs"] = [
        {**job_summary(job), "reason": reasons.get(job.get("html_url"))}
        for job in detailed
    ]

    suite = record["suite"]
    if suite in ("java-it", "python"):
        artifacts = mq.paginated_items(
            f"/repos/{owner}/{repo}/actions/runs/{run['id']}/artifacts",
            "artifacts",
            token,
        )
        if suite == "java-it":
            picked, missing = java_lane_artifacts(artifacts, failed_jobs, run["id"], attempt)
            record["missingEvidence"] += missing
        else:
            picked = python_artifacts(artifacts)
        for artifact in picked:
            if artifact.get("expired"):
                record["missingEvidence"].append(f"{artifact['name']} expired")
                continue
            size = int(artifact.get("size_in_bytes") or 0)
            if size > MAX_ARTIFACT_BYTES:
                record["missingEvidence"].append(f"{artifact['name']} oversized ({size} bytes)")
                continue
            if not budget.take(size):
                record["missingEvidence"].append("download budget exhausted")
                return record
            with read_zip(pfr.download_zip(owner, repo, artifact, token)) as archive:
                outcome, reports, problems = outcomes_from_archive(archive, run["id"], attempt)
            record["missingEvidence"] += [f"{artifact['name']}: {p}" for p in problems]
            # A later attempt overwrote this artifact (Python names carry no attempt).
            if outcome is None or any(p.startswith("outcome belongs to") for p in problems):
                continue
            if suite == "python" and outcome.get("classification") == "passed":
                continue
            record["outcomes"].append(outcome_record(artifact["name"], outcome))
            if reports:
                target = files_dir / safe_name(artifact["name"])
                target.mkdir(parents=True, exist_ok=True)
                for name, content in reports.items():
                    (target / safe_name(name)).write_bytes(content)
    elif suite == "playwright":
        record["playwright"] = {"failed": [], "flaky": [], "annotatedFlaky": []}
        try:
            flaky = pfr.read_flaky(attempt_run, token)
            record["playwright"]["annotatedFlaky"] = [
                {"file": f, "title": t, "line": line} for (f, t), line in flaky.items()
            ]
        except pfr.READ_ERRORS as exc:
            record["missingEvidence"].append(f"retry-pass annotations: {exc}")
        artifacts = mq.paginated_items(
            f"/repos/{owner}/{repo}/actions/runs/{run['id']}/artifacts",
            "artifacts",
            token,
        )
        try:
            picked = pfr.pick_results(artifacts, attempt)
        except mq.ApiError as exc:
            picked = []
            record["missingEvidence"].append(f"results: {exc}")
        for artifact in picked:
            size = int(artifact.get("size_in_bytes") or 0)
            if not budget.take(size):
                record["missingEvidence"].append("download budget exhausted")
                return record
            with read_zip(pfr.download_zip(owner, repo, artifact, token)) as archive:
                for member in archive.infolist():
                    if not member.filename.endswith("results.json"):
                        continue
                    results = json.loads(member_bytes(archive, member, pfr.MAX_RESULTS_BYTES))
                    failed, flaky = playwright_tests(results)
                    shard = pfr.RESULTS_RE.match(artifact["name"])["shard"]
                    record["playwright"]["failed"] += [{**t, "shard": shard} for t in failed]
                    record["playwright"]["flaky"] += [{**t, "shard": shard} for t in flaky]
        shards_read = {pfr.RESULTS_RE.match(a["name"])["shard"] for a in picked}
        unread = [
            job["name"]
            for job in failed_jobs
            if (match := pfr.SHARD_JOB_RE.search(job["name"])) and match[1] not in shards_read
        ]
        if unread:
            record["missingEvidence"].append(
                "failed shards without results: " + ", ".join(unread[:10])
            )

    record["complete"] = not any(
        "budget" in note for note in record["missingEvidence"]
    )
    return record


def already_archived(out: Path, run_id: int, attempt: int) -> bool:
    path = record_path(out, run_id, attempt)
    if not path.exists():
        return False
    try:
        return bool(json.loads(path.read_text()).get("complete"))
    except (OSError, json.JSONDecodeError):
        return False


def write_record(out: Path, record: dict) -> None:
    path = record_path(out, record["runId"], record["attempt"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=1, sort_keys=True))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--owner", default="open-metadata")
    parser.add_argument("--repo", default="OpenMetadata")
    parser.add_argument("--since", required=True, help="UTC ISO date or time")
    parser.add_argument(
        "--until", default="", help="UTC ISO date or time; default one hour ago"
    )
    parser.add_argument("--out", type=Path, default=Path("target/ci-replay"))
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--max-download-mb", type=int, default=2048)
    parser.add_argument(
        "--max-attempts", type=int, default=0, help="Stop after this many (0 = all)"
    )
    parser.add_argument(
        "--suites",
        default="java-it,python,playwright,other",
        help="Comma-separated subset of java-it, python, playwright, other",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    token = mq.env_token()
    # Runs still finishing are left for the next harvest rather than read half-written.
    until = pfr.parse_when(args.until, mq.utcnow() - timedelta(hours=1))
    since = pfr.parse_when(args.since, until)
    # An empty --since would otherwise collapse the window and report success.
    if since >= until:
        print(f"::error::--since ({args.since!r}) must be before --until")
        return 1
    try:
        runs = list_runs(args.owner, args.repo, since, until, token, args.workers)
    except (mq.ApiError, OSError) as exc:
        print(f"::error::Could not list merge-group runs: {exc}")
        return 1
    print(f"listed {len(runs)} merge-group runs", flush=True)

    suites = {s.strip() for s in args.suites.split(",") if s.strip()}
    candidates = [
        run
        for run in runs
        if suite_of(run) in suites
        and (run.get("conclusion") in FAILED or int(run.get("run_attempt") or 1) > 1)
    ]
    attempts: list[tuple[dict, int, str | None]] = []
    for run in candidates:
        try:
            attempts += [(run, a, later) for a, later in list_attempts(args.owner, args.repo, run, token)]
        except (mq.ApiError, OSError) as exc:
            print(f"::warning::Run {run['id']} attempts: {exc}")
    todo = [item for item in attempts if not already_archived(args.out, item[0]["id"], item[1])]
    if args.max_attempts:
        todo = todo[: args.max_attempts]

    budget = Budget(args.max_download_mb * 1024 * 1024)
    status: Counter[str] = Counter()
    status_lock = threading.Lock()

    def work(item: tuple[dict, int, str | None]) -> None:
        run, attempt, later = item
        try:
            record = harvest_attempt(
                args.owner, args.repo, run, attempt, later, token, budget, args.out
            )
            write_record(args.out, record)
            outcome = "complete" if record["complete"] else "partial"
        except (*pfr.READ_ERRORS, json.JSONDecodeError) as exc:
            print(f"::warning::Run {run['id']} attempt {attempt}: {exc}")
            outcome = "unreadable"
        with status_lock:
            status[outcome] += 1

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        list(pool.map(work, todo))

    summary = {
        "since": since.astimezone(timezone.utc).isoformat(),
        "until": until.astimezone(timezone.utc).isoformat(),
        "runsListed": len(runs),
        "failedAttempts": len(attempts),
        "alreadyArchived": len(attempts) - len(todo) if not args.max_attempts else None,
        "harvested": dict(status),
        "downloadedMB": round(budget.used / 1048576, 1),
        "bySuite": dict(Counter(suite_of(run) for run, _, _ in todo)),
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "last-harvest.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary))
    return 2 if status["partial"] or status["unreadable"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
