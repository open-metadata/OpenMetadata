#!/usr/bin/env python3
"""Daily CI health report: merge-queue Playwright outcomes and runner-hours.

Reports, for the trailing 24h and 7d:
  * merge-queue runs of the Playwright workflow: runs, distinct PRs, entries
    per PR, and the fail rate (failed / (failed + succeeded); cancelled runs,
    mostly superseded queue groups, are counted apart);
  * runner-hours per workflow: the sum of every job's duration, split into PR
    (pull_request, pull_request_target), merge-queue and other events;
  * the most frequent flaky tests in the merge queue over 24h, from the
    `playwright-flaky-tests` artifacts the Playwright summary job uploads.

Costs, measured on open-metadata/OpenMetadata in October 2026: ~9,500 runs a
day carry the events in RUNNER_EVENTS. Job durations come from GraphQL, 50
runs per query (`resource(url: <run url>)` -> checkSuite.checkRuns), at one
rate-limit point per query; runs from the REST listing, 100 per call. A day is
then ~200 GraphQL points and ~150 REST calls, but a week would be ~1,300 points
and ~1,000 calls, more than GITHUB_TOKEN's hourly budget. So runner-hours are
measured for the last 24h only, and the 7d figure sums the 24h measurements of
this report's own earlier runs (the `ci-health-report` artifact), saying how
much of the week those cover. The queue numbers are cheap (one workflow) and
are measured directly for both windows.

The REST listing returns at most 1,000 runs per filtered search, so windows
are listed in slices that split further when full. Only completed runs count;
one still in progress at report time is left out.

Writes markdown to --summary (pass $GITHUB_STEP_SUMMARY) and the numbers to
--json-output. Exits 1 only when runs cannot be listed.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import time
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Protocol

QUEUE_WORKFLOW = ".github/workflows/playwright-postgresql-e2e.yml"
REPORT_ARTIFACT = "ci-health-report"
REPORT_FILE = "ci-health.json"
FLAKY_ARTIFACT = "playwright-flaky-tests"
FLAKY_FILE = "playwright-flaky-tests.json"
# Events that start CI jobs. Bot and comment events (issue_comment,
# workflow_run, check_suite, reviews, dynamic agent runs) are left out: they
# are numerous and run seconds-long jobs.
RUNNER_EVENTS = (
    "pull_request",
    "pull_request_target",
    "merge_group",
    "push",
    "schedule",
    "workflow_dispatch",
)
PR_EVENTS = {"pull_request", "pull_request_target"}
EVENT_GROUPS = ("pr", "queue", "other")
QUEUE_BRANCH = re.compile(r"^gh-readonly-queue/.+/pr-(?P<pr>\d+)-")
LISTING_CAP = 1000
GRAPHQL_BATCH = 50
SLICE = timedelta(hours=6)
MIN_SLICE = timedelta(minutes=5)
DAY = timedelta(hours=24)
WEEK = timedelta(days=7)
# Daily reports whose windows overlap by more than this are the same day twice
# (a manual dispatch next to the schedule); only the newer one is summed.
OVERLAP_TOLERANCE = timedelta(minutes=30)
TOP_WORKFLOWS = 25
TOP_FLAKY = 15
MAX_FLAKY_ARTIFACTS = 200
MAX_PREVIOUS_REPORTS = 14


class ApiError(RuntimeError):
    pass


class GitHubApi(Protocol):
    def rest(self, path: str, params: dict[str, Any]) -> Any: ...

    def graphql(self, query: str, variables: dict[str, str] | None = None) -> Any: ...

    def download(self, path: str) -> bytes: ...


class GhCli:
    """`gh api` with a few retries; GH_TOKEN comes from the environment."""

    def _run(self, args: list[str]) -> bytes:
        error = ""
        for attempt in range(3):
            done = subprocess.run(["gh", "api", *args], capture_output=True, check=False)
            if done.returncode == 0:
                return done.stdout
            error = done.stderr.decode(errors="replace").strip()
            time.sleep(3 * (attempt + 1))
        raise ApiError(f"gh api {args[0]} failed: {error[:300]}")

    def rest(self, path: str, params: dict[str, Any]) -> Any:
        args = [path, "-X", "GET"]
        for key, value in params.items():
            args += ["-f", f"{key}={value}"]
        return json.loads(self._run(args))

    def graphql(self, query: str, variables: dict[str, str] | None = None) -> Any:
        args = ["graphql", "-f", f"query={query}"]
        for key, value in (variables or {}).items():
            args += ["-f", f"{key}={value}"]
        payload = json.loads(self._run(args))
        if payload.get("errors") and not payload.get("data"):
            raise ApiError(f"GraphQL: {payload['errors'][0].get('message', '')}")
        return payload.get("data") or {}

    def download(self, path: str) -> bytes:
        return self._run([path])


# ------------------------------------------------------------------ time utils


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def in_window(item: dict[str, Any], start: datetime, end: datetime) -> bool:
    created = parse_ts(item.get("created_at"))
    return created is not None and start <= created <= end


# --------------------------------------------------------------------- listing


def list_runs(
    api: GitHubApi, path: str, start: datetime, end: datetime, params: dict[str, Any]
) -> list[dict[str, Any]]:
    """Every completed run created in [start, end] from a run-listing endpoint."""
    runs: dict[int, dict[str, Any]] = {}

    def fetch(lo: datetime, hi: datetime) -> None:
        query = {**params, "created": f"{iso(lo)}..{iso(hi)}", "status": "completed", "per_page": 100}
        page = api.rest(path, {**query, "page": 1})
        total = int(page.get("total_count", 0))
        if total > LISTING_CAP and hi - lo > MIN_SLICE:
            middle = lo + (hi - lo) / 2
            fetch(lo, middle)
            fetch(middle + timedelta(seconds=1), hi)
            return
        number = 1
        while True:
            batch = page.get("workflow_runs", [])
            for run in batch:
                runs[run["id"]] = run
            if len(batch) < 100 or number * 100 >= min(total, LISTING_CAP):
                return
            number += 1
            page = api.rest(path, {**query, "page": number})

    cursor = start
    while cursor <= end:
        slice_end = min(cursor + SLICE, end)
        fetch(cursor, slice_end)
        cursor = slice_end + timedelta(seconds=1)
    return sorted(runs.values(), key=lambda run: run["id"])


RUN_FIELDS = """... on WorkflowRun { checkSuite { id checkRuns(first: 100) {
  pageInfo { hasNextPage endCursor } nodes { startedAt completedAt } } } }"""
MORE_CHECK_RUNS = """query($id: ID!, $after: String!) { node(id: $id) { ... on CheckSuite {
  checkRuns(first: 100, after: $after) { pageInfo { hasNextPage endCursor }
  nodes { startedAt completedAt } } } } }"""


def batch_query(run_urls: list[str]) -> str:
    aliases = " ".join(
        f"r{index}: resource(url: {json.dumps(url)}) {{ {RUN_FIELDS} }}"
        for index, url in enumerate(run_urls)
    )
    return f"query {{ {aliases} }}"


def job_seconds(check_runs: Iterable[dict[str, Any]]) -> float:
    """Sum of job durations; a job that never started or finished counts zero."""
    total = 0.0
    for check_run in check_runs:
        started = parse_ts(check_run.get("startedAt"))
        completed = parse_ts(check_run.get("completedAt"))
        if started and completed and completed > started:
            total += (completed - started).total_seconds()
    return total


def durations_from_batch(
    data: dict[str, Any], run_ids: list[int]
) -> tuple[dict[int, float], dict[int, tuple[str, str]]]:
    """Seconds per run id, and (check suite id, cursor) for runs with >100 jobs."""
    seconds: dict[int, float] = {}
    more: dict[int, tuple[str, str]] = {}
    for index, run_id in enumerate(run_ids):
        suite = (data.get(f"r{index}") or {}).get("checkSuite") or {}
        if not suite:
            continue
        check_runs = suite.get("checkRuns") or {}
        seconds[run_id] = job_seconds(check_runs.get("nodes") or [])
        page = check_runs.get("pageInfo") or {}
        if page.get("hasNextPage"):
            more[run_id] = (suite["id"], page["endCursor"])
    return seconds, more


def fetch_durations(api: GitHubApi, runs: list[dict[str, Any]]) -> dict[int, float]:
    """Job seconds per run id. Runs that could not be read are left out."""
    batches = [runs[i : i + GRAPHQL_BATCH] for i in range(0, len(runs), GRAPHQL_BATCH)]

    def one(batch: list[dict[str, Any]]) -> dict[int, float]:
        ids = [run["id"] for run in batch]
        try:
            data = api.graphql(batch_query([run["html_url"] for run in batch]))
            seconds, more = durations_from_batch(data, ids)
            for run_id, (suite_id, cursor) in more.items():
                while cursor:
                    node = api.graphql(MORE_CHECK_RUNS, {"id": suite_id, "after": cursor})
                    page = (node.get("node") or {}).get("checkRuns") or {}
                    seconds[run_id] += job_seconds(page.get("nodes") or [])
                    info = page.get("pageInfo") or {}
                    cursor = info.get("endCursor") if info.get("hasNextPage") else ""
        except ApiError as error:
            # Left out rather than zero: the report counts these as unmeasured.
            print(f"::warning::job durations unavailable for {len(ids)} runs: {error}")
            return {}
        return seconds

    durations: dict[int, float] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(one, batches):
            durations.update(result)
    return durations


def download_json(api: GitHubApi, owner: str, repo: str, artifact: dict[str, Any], name: str) -> Any:
    try:
        archive = api.download(f"repos/{owner}/{repo}/actions/artifacts/{artifact['id']}/zip")
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            return json.loads(bundle.read(name))
    except (ApiError, zipfile.BadZipFile, KeyError, json.JSONDecodeError):
        return None


def list_artifacts(
    api: GitHubApi, owner: str, repo: str, name: str, start: datetime, end: datetime, limit: int
) -> list[dict[str, Any]]:
    """Unexpired artifacts called `name` created in the window, newest first."""
    found: list[dict[str, Any]] = []
    page = 1
    while len(found) < limit:
        batch = api.rest(
            f"repos/{owner}/{repo}/actions/artifacts",
            {"name": name, "per_page": 100, "page": page},
        ).get("artifacts", [])
        found += [a for a in batch if not a.get("expired") and in_window(a, start, end)]
        oldest = parse_ts(batch[-1].get("created_at")) if batch else None
        if len(batch) < 100 or (oldest is not None and oldest < start):
            break
        page += 1
    return sorted(found, key=lambda a: a.get("created_at", ""), reverse=True)[:limit]


# ----------------------------------------------------------------- aggregation


def queue_entry_pr(head_branch: str | None) -> int | None:
    match = QUEUE_BRANCH.match(head_branch or "")
    return int(match.group("pr")) if match else None


def workflow_key(run: dict[str, Any]) -> str:
    """Workflow file path: stable, where a run's `name` can carry a SHA or PR."""
    return str(run.get("path") or run.get("name") or "unknown").split("@")[0]


def event_group(event: str | None) -> str:
    if event in PR_EVENTS:
        return "pr"
    return "queue" if event == "merge_group" else "other"


def queue_metrics(runs: list[dict[str, Any]], start: datetime, end: datetime) -> dict[str, Any]:
    queue = [run for run in runs if run.get("event") == "merge_group" and in_window(run, start, end)]
    conclusions = Counter(run.get("conclusion") or "unknown" for run in queue)
    prs = {pr for run in queue if (pr := queue_entry_pr(run.get("head_branch"))) is not None}
    decided = conclusions["success"] + conclusions["failure"]
    return {
        "runs": len(queue),
        "distinctPrs": len(prs),
        "entriesPerPr": round(len(queue) / len(prs), 2) if prs else None,
        "succeeded": conclusions["success"],
        "failed": conclusions["failure"],
        "cancelled": conclusions["cancelled"],
        "other": len(queue) - decided - conclusions["cancelled"],
        "failRate": round(conclusions["failure"] / decided, 3) if decided else None,
    }


def runner_hours_by_workflow(
    runs: list[dict[str, Any]], durations: dict[int, float]
) -> dict[str, dict[str, Any]]:
    totals: dict[str, dict[str, Any]] = {}
    for run in runs:
        entry = totals.setdefault(
            workflow_key(run),
            {"runs": 0, "hours": 0.0, "byEvent": dict.fromkeys(EVENT_GROUPS, 0.0), "unmeasured": 0},
        )
        entry["runs"] += 1
        if run["id"] not in durations:
            entry["unmeasured"] += 1
            continue
        hours = durations[run["id"]] / 3600
        entry["hours"] += hours
        entry["byEvent"][event_group(run.get("event"))] += hours
    return totals


def select_daily_reports(reports: list[dict[str, Any]], week_start: datetime) -> list[dict[str, Any]]:
    """Newest-first daily reports whose 24h windows do not overlap and fall in the week."""
    chosen: list[dict[str, Any]] = []
    taken: list[tuple[datetime, datetime]] = []
    for report in sorted(reports, key=lambda r: r["window"]["end"], reverse=True):
        start = parse_ts(report["window"]["start"])
        end = parse_ts(report["window"]["end"])
        if start is None or end is None or start < week_start - OVERLAP_TOLERANCE:
            continue
        if any(start < t_end - OVERLAP_TOLERANCE and end > t_start + OVERLAP_TOLERANCE for t_start, t_end in taken):
            continue
        taken.append((start, end))
        chosen.append(report)
    return chosen


def rollup_runner_hours(daily: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], float]:
    """Sum per-workflow runner-hours over daily reports; also the hours covered."""
    totals: dict[str, dict[str, Any]] = {}
    covered = 0.0
    for report in daily:
        covered += (parse_ts(report["window"]["end"]) - parse_ts(report["window"]["start"])).total_seconds() / 3600
        for name, entry in report["runnerHours"].items():
            total = totals.setdefault(
                name,
                {"runs": 0, "hours": 0.0, "byEvent": dict.fromkeys(EVENT_GROUPS, 0.0), "unmeasured": 0},
            )
            total["runs"] += entry.get("runs", 0)
            total["hours"] += entry.get("hours", 0.0)
            total["unmeasured"] += entry.get("unmeasured", 0)
            for group in EVENT_GROUPS:
                total["byEvent"][group] += entry.get("byEvent", {}).get(group, 0.0)
    return totals, covered


def top_flaky(payloads: list[dict[str, Any]], limit: int = TOP_FLAKY) -> list[dict[str, Any]]:
    """Rank tests by the number of runs in which they passed only on retry."""
    hits: Counter[tuple[str, str]] = Counter()
    for payload in payloads:
        keys = {(str(t.get("spec", "")), str(t.get("title", ""))) for t in payload.get("tests", [])}
        hits.update(keys)
    ranked = sorted(hits.items(), key=lambda item: (-item[1], item[0]))[:limit]
    return [{"spec": spec, "title": title, "runs": count} for (spec, title), count in ranked]


# ------------------------------------------------------------------- rendering


def rounded(totals: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        name: {
            **entry,
            "hours": round(entry["hours"], 2),
            "byEvent": {group: round(hours, 2) for group, hours in entry["byEvent"].items()},
        }
        for name, entry in totals.items()
    }


def fmt(value: Any) -> str:
    return "n/a" if value is None else str(value)


def pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def short(path: str) -> str:
    return path.rsplit("/", 1)[-1]


def render_markdown(report: dict[str, Any]) -> str:
    lines = [f"## CI health — {report['generatedAt']}", ""]
    lines += [
        f"### Merge-queue Playwright (`{short(report['queueWorkflow'])}`)",
        "",
        "| Window | Queue runs | Distinct PRs | Entries / PR | Succeeded | Failed | Cancelled | Fail rate |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for label in ("24h", "7d"):
        q = report["queue"][label]
        lines.append(
            f"| {label} | {q['runs']} | {q['distinctPrs']} | {fmt(q['entriesPerPr'])} | "
            f"{q['succeeded']} | {q['failed']} | {q['cancelled']} | {pct(q['failRate'])} |"
        )
    lines += [
        "",
        "Fail rate is failed / (failed + succeeded); a cancelled queue run was usually superseded.",
        "",
        "### Runner-hours by workflow (sum of job durations)",
        "",
        "| Workflow | 24h hours | 24h runs | 24h PR | 24h queue | 7d hours | 7d runs |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    day = report["runnerHours"]["24h"]
    week = report["runnerHours"]["7d"]
    names = sorted(set(day) | set(week), key=lambda n: (-week.get(n, {}).get("hours", 0.0), n))
    empty = {"hours": 0.0, "runs": 0, "byEvent": dict.fromkeys(EVENT_GROUPS, 0.0)}
    for name in names[:TOP_WORKFLOWS]:
        d, w = day.get(name, empty), week.get(name, empty)
        lines.append(
            f"| {short(name)} | {d['hours']:.1f} | {d['runs']} | {d['byEvent']['pr']:.1f} | "
            f"{d['byEvent']['queue']:.1f} | {w['hours']:.1f} | {w['runs']} |"
        )
    lines.append(
        f"| **All {len(names)} workflows** | {sum(e['hours'] for e in day.values()):.1f} | "
        f"{sum(e['runs'] for e in day.values())} | {sum(e['byEvent']['pr'] for e in day.values()):.1f} | "
        f"{sum(e['byEvent']['queue'] for e in day.values()):.1f} | "
        f"{sum(e['hours'] for e in week.values()):.1f} | {sum(e['runs'] for e in week.values())} |"
    )
    lines += [
        "",
        f"Events counted: {', '.join(RUNNER_EVENTS)}. The 7d columns sum "
        f"{report['weekCoverage']['reports']} daily report(s) covering "
        f"{report['weekCoverage']['hours']:.0f} of 168 hours.",
    ]
    unmeasured = sum(entry["unmeasured"] for entry in day.values())
    if unmeasured:
        lines.append(f"{unmeasured} run(s) in 24h had no readable job data and count zero hours.")

    flaky = report["flaky"]
    lines += ["", "### Top flaky tests in the merge queue (24h, passed only on retry)", ""]
    if not flaky["artifacts"]:
        lines.append(f"No `{FLAKY_ARTIFACT}` artifacts from merge-queue runs in the window.")
    else:
        lines.append(f"From {flaky['readable']} of {flaky['artifacts']} merge-queue run(s) that uploaded one.")
        lines.append("")
        if flaky["tests"]:
            lines += ["| Test | Runs |", "|---|---:|"]
            lines += [f"| `{t['spec']}` › {t['title']} | {t['runs']} |" for t in flaky["tests"]]
        else:
            lines.append("No test needed a retry to pass.")
    return "\n".join(lines) + "\n"


# ------------------------------------------------------------------------ main


def collect_runner_runs(api: GitHubApi, owner: str, repo: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
    path = f"repos/{owner}/{repo}/actions/runs"
    runs: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for listed in pool.map(lambda event: list_runs(api, path, start, end, {"event": event}), RUNNER_EVENTS):
            runs += listed
    # A skipped run started no runner; leaving it out saves GraphQL queries.
    return [run for run in runs if run.get("conclusion") != "skipped"]


def build_report(
    api: GitHubApi,
    owner: str,
    repo: str,
    now: datetime,
    queue_workflow: str = QUEUE_WORKFLOW,
    durations: Callable[[GitHubApi, list[dict[str, Any]]], dict[int, float]] = fetch_durations,
) -> dict[str, Any]:
    day_start, week_start = now - DAY, now - WEEK
    workflow_file = short(queue_workflow)
    queue_runs = list_runs(
        api, f"repos/{owner}/{repo}/actions/workflows/{workflow_file}/runs", week_start, now, {"event": "merge_group"}
    )

    runs = collect_runner_runs(api, owner, repo, day_start, now)
    today = {
        "window": {"start": iso(day_start), "end": iso(now)},
        "runnerHours": rounded(runner_hours_by_workflow(runs, durations(api, runs))),
    }
    previous = [
        payload
        for artifact in list_artifacts(api, owner, repo, REPORT_ARTIFACT, week_start, now, MAX_PREVIOUS_REPORTS)
        if isinstance(payload := download_json(api, owner, repo, artifact, REPORT_FILE), dict)
        and isinstance(payload.get("today"), dict)
    ]
    daily = select_daily_reports([today, *(payload["today"] for payload in previous)], week_start)
    week_hours, covered = rollup_runner_hours(daily)

    queue_artifacts = [
        artifact
        for artifact in list_artifacts(api, owner, repo, FLAKY_ARTIFACT, day_start, now, MAX_FLAKY_ARTIFACTS)
        if queue_entry_pr((artifact.get("workflow_run") or {}).get("head_branch")) is not None
    ]
    with ThreadPoolExecutor(max_workers=4) as pool:
        payloads = [
            p
            for p in pool.map(lambda a: download_json(api, owner, repo, a, FLAKY_FILE), queue_artifacts)
            if isinstance(p, dict)
        ]

    return {
        "generatedAt": iso(now),
        "repository": f"{owner}/{repo}",
        "queueWorkflow": queue_workflow,
        "queue": {
            "24h": queue_metrics(queue_runs, day_start, now),
            "7d": queue_metrics(queue_runs, week_start, now),
        },
        # `today` is what a later run of this report reads back for its 7d sum.
        "today": today,
        "runnerHours": {"24h": today["runnerHours"], "7d": rounded(week_hours)},
        "weekCoverage": {"reports": len(daily), "hours": round(covered, 1)},
        "flaky": {"artifacts": len(queue_artifacts), "readable": len(payloads), "tests": top_flaky(payloads)},
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--queue-workflow", default=QUEUE_WORKFLOW)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--json-output", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    try:
        report = build_report(GhCli(), args.owner, args.repo, now, args.queue_workflow)
    except ApiError as error:
        print(f"::error::Could not build the CI health report: {error}", file=sys.stderr)
        return 1
    markdown = render_markdown(report)
    print(markdown)
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as summary:
            summary.write(markdown)
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
