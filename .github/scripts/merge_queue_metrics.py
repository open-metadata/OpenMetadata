#!/usr/bin/env python3
"""Shared merge-queue measurement helpers for the health alert and daily report.

Two independent data sources, deliberately kept apart:

  * **live queue** — `repository.mergeQueue`. Instantaneous. Vanishes the moment an
    entry merges or is dequeued, so it cannot be reconstructed after the fact.
  * **realized history** — `ADDED_TO_MERGE_QUEUE_EVENT` /
    `REMOVED_FROM_MERGE_QUEUE_EVENT` on the PR timeline. Survives the merge, so every
    historical window is recomputable from scratch and no rolling state is stored.

Two API traps this module exists to contain:

  1. ``timelineItems.totalCount`` IGNORES the ``itemTypes`` filter — it returns the size
     of the PR's whole timeline. Reading it makes every PR look enqueued (measured: a
     PR that never entered the queue reported 64). Nothing here ever reads it; the
     length of ``nodes`` is the only count.
  2. GitHub's ``estimatedTimeToMerge`` assumes every entry merges on its first pass, so
     it is optimistic exactly when the queue is worst (measured: 3.00 merges/h
     projected against 0.71/h realized, 4.2x). It is reported for context but never
     alerted on; ``head_entry_age`` is an observed elapsed duration and cannot be wrong.
"""

from __future__ import annotations

import io
import json
import os
import re
import statistics
import subprocess
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Sequence
from urllib.parse import urlencode

GITHUB_GRAPHQL = "https://api.github.com/graphql"
GITHUB_REST = "https://api.github.com"

# Timeline events are the only queue-related item types GitHub exposes. A successful
# merge is encoded as a REMOVAL with reason "merged", which is why merges have to be
# filtered out of the removal reasons before anything is called a failure.
MERGE_REASON = "merged"

# Page caps. Hitting one means the window was only partially measured, which is
# indistinguishable from a quiet window unless it is said out loud — same reasoning as
# the 20-page runaway guard in prune-ephemeral-caches.yml.
MAX_SEARCH_PAGES = 12
SEARCH_PAGE_SIZE = 100
MAX_QUEUE_EVENTS_PER_PR = 50


class ApiError(RuntimeError):
    """A GitHub API call failed. ``status`` is the HTTP status where there was one."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class CheckAccessError(ApiError):
    """The token cannot read check runs — almost always a missing `checks: read`.

    Kept distinct from a missing commit so the report can say "unreadable" instead of
    "none found"; the two are indistinguishable to a reader but opposite in meaning.
    """


# --------------------------------------------------------------------------- api


def _request(
    url: str, token: str, data: bytes | None = None, accept: str = "application/json"
) -> Any:
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": accept,
            "Content-Type": "application/json",
            "User-Agent": "openmetadata-merge-queue-metrics",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        # HTTPError subclasses URLError, so without this it would be swallowed by the
        # network-retry path and a 403 would cost three backoffs before failing.
        raise ApiError(
            f"HTTP {exc.code} {exc.reason} for {url}", status=exc.code
        ) from exc


def _retryable(exc: Exception) -> bool:
    """A 4xx is a decision, not a hiccup — retrying only multiplies the latency of a
    failure that cannot succeed. 429 is the one worth waiting out."""
    if isinstance(exc, ApiError) and exc.status is not None:
        return exc.status == 429 or exc.status >= 500
    return True


def _retrying(fn, attempts: int = 3, backoff: float = 3.0):
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return fn()
        except (
            ApiError,
            urllib.error.URLError,
            TimeoutError,
            json.JSONDecodeError,
        ) as exc:
            if not _retryable(exc):
                raise
            last = exc
            if attempt < attempts - 1:
                time.sleep(backoff * (attempt + 1))
    raise ApiError(f"GitHub API unreachable after {attempts} attempts: {last}")


def graphql(query: str, variables: dict[str, Any], token: str) -> dict[str, Any]:
    payload = _retrying(
        lambda: _request(
            GITHUB_GRAPHQL,
            token,
            data=json.dumps({"query": query, "variables": variables}).encode(),
        )
    )
    # A GraphQL error arrives with HTTP 200, so it has to be checked explicitly or a
    # failed read is silently measured as an empty queue.
    if payload.get("errors"):
        raise RuntimeError(f"GraphQL errors: {json.dumps(payload['errors'])}")
    return payload["data"]


def rest(path: str, token: str) -> Any:
    return _retrying(lambda: _request(f"{GITHUB_REST}{path}", token))


# ----------------------------------------------------------------------- parsing


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def hours_between(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 3600.0


def percentile(values: Sequence[float], fraction: float) -> float | None:
    """Nearest-rank percentile. Returns None for an empty sample rather than raising —
    a window with no merges is a normal state, not an error."""
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(int(len(ordered) * fraction), len(ordered) - 1)]


# -------------------------------------------------------------------- live queue

QUEUE_QUERY = """
query($owner: String!, $repo: String!, $branch: String!) {
  repository(owner: $owner, name: $repo) {
    mergeQueue(branch: $branch) {
      nextEntryEstimatedTimeToMerge
      entries(first: 100) {
        totalCount
        nodes {
          position
          estimatedTimeToMerge
          enqueuedAt
          state
          pullRequest { number title url }
        }
      }
    }
  }
}
"""


def live_queue(owner: str, repo: str, branch: str, token: str) -> dict[str, Any]:
    data = graphql(QUEUE_QUERY, {"owner": owner, "repo": repo, "branch": branch}, token)
    return data["repository"]["mergeQueue"] or {}


def queue_metrics(queue: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Reduce a live queue payload to the readings the alert decides on.

    ``entries.totalCount`` is safe to read here — unlike on timelineItems, this
    connection carries no type filter for it to ignore.
    """
    entries = sorted(
        (queue.get("entries") or {}).get("nodes") or [],
        key=lambda node: node.get("position") or 0,
    )
    depth = (queue.get("entries") or {}).get("totalCount", len(entries))

    head = entries[0] if entries else None
    head_age = hours_between(parse_ts(head["enqueuedAt"]), now) if head else None
    oldest_age = (
        max(hours_between(parse_ts(e["enqueuedAt"]), now) for e in entries)
        if entries
        else None
    )

    # GitHub's per-position ladder is linear, so successive deltas recover the service
    # time its projection assumes. The median absorbs the odd non-uniform step.
    steps = [
        b["estimatedTimeToMerge"] - a["estimatedTimeToMerge"]
        for a, b in zip(entries, entries[1:])
        if a.get("estimatedTimeToMerge") is not None
        and b.get("estimatedTimeToMerge") is not None
    ]
    service_step = statistics.median(steps) if steps else None

    states: dict[str, int] = {}
    for entry in entries:
        states[entry["state"]] = states.get(entry["state"], 0) + 1

    return {
        "depth": depth,
        "head_entry_age_h": head_age,
        "head_pr": (head or {}).get("pullRequest"),
        "oldest_entry_age_h": oldest_age,
        "service_step_s": service_step,
        "github_rate_per_h": 3600.0 / service_step if service_step else None,
        "next_entry_eta_h": (
            queue["nextEntryEstimatedTimeToMerge"] / 3600.0
            if queue.get("nextEntryEstimatedTimeToMerge") is not None
            else None
        ),
        "states": states,
        "stuck_states": {
            s: n for s, n in states.items() if s in ("UNMERGEABLE", "LOCKED")
        },
    }


# ------------------------------------------------------------- realized history

# `updated:` rather than `merged:` so PRs dequeued and still open are counted. Scoping
# to merged PRs only would undercount failures, because a PR that keeps failing checks
# never merges and would never appear.
HISTORY_QUERY = """
query($q: String!, $cursor: String, $pageSize: Int!, $events: Int!) {
  search(query: $q, type: ISSUE, first: $pageSize, after: $cursor) {
    pageInfo { endCursor hasNextPage }
    nodes {
      ... on PullRequest {
        number
        url
        merged
        mergedAt
        adds: timelineItems(first: $events, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT]) {
          nodes { ... on AddedToMergeQueueEvent { createdAt } }
        }
        removals: timelineItems(first: $events, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
          nodes {
            ... on RemovedFromMergeQueueEvent {
              createdAt
              reason
              beforeCommit { oid }
            }
          }
        }
      }
    }
  }
}
"""


def fetch_history(
    owner: str, repo: str, branch: str, since: datetime, token: str
) -> tuple[list[dict[str, Any]], bool]:
    query = (
        f"repo:{owner}/{repo} is:pr base:{branch} "
        f"updated:>={since.strftime('%Y-%m-%d')}"
    )
    nodes: list[dict[str, Any]] = []
    cursor: str | None = None
    for _ in range(MAX_SEARCH_PAGES):
        data = graphql(
            HISTORY_QUERY,
            {
                "q": query,
                "cursor": cursor,
                "pageSize": SEARCH_PAGE_SIZE,
                "events": MAX_QUEUE_EVENTS_PER_PR,
            },
            token,
        )
        page = data["search"]
        nodes.extend(n for n in page["nodes"] if n)
        if not page["pageInfo"]["hasNextPage"]:
            return nodes, False
        cursor = page["pageInfo"]["endCursor"]
    # Returned, not raised: a partial window said out loud beats no report at all, and
    # the digest is documented to always post. Callers MUST surface the flag — a
    # silently short window is indistinguishable from a quiet week.
    return nodes, True


def _adds(pr: dict[str, Any]) -> list[dict[str, Any]]:
    # nodes, never totalCount — see the module docstring.
    return (pr.get("adds") or {}).get("nodes") or []


def _removals(pr: dict[str, Any]) -> list[dict[str, Any]]:
    return (pr.get("removals") or {}).get("nodes") or []


def realized_metrics(
    prs: Iterable[dict[str, Any]], window_start: datetime, window_end: datetime
) -> dict[str, Any]:
    """Recompute a window's queue behaviour from timeline history alone.

    ``first_pass_*`` measures a single clean trip through the queue — the thing
    GitHub's estimate models. ``total_*`` measures what the PR author actually waited,
    including every wasted pass. The gap between them is the re-queue penalty.
    """
    total_latency: list[float] = []
    first_pass_latency: list[float] = []
    enqueue_count: list[int] = []
    merged_via_queue = 0
    merged_bypassing = 0
    reasons: dict[str, int] = {}
    failed_commits: list[str] = []

    for pr in prs:
        adds = _adds(pr)

        for removal in _removals(pr):
            created = parse_ts(removal["createdAt"])
            if not window_start <= created <= window_end:
                continue
            reason = removal.get("reason") or "unknown"
            reasons[reason] = reasons.get(reason, 0) + 1
            if reason == "failed_checks" and (removal.get("beforeCommit") or {}).get(
                "oid"
            ):
                failed_commits.append(removal["beforeCommit"]["oid"])

        if not pr.get("merged") or not pr.get("mergedAt"):
            continue
        merged_at = parse_ts(pr["mergedAt"])
        if not window_start <= merged_at <= window_end:
            continue

        if not adds:
            merged_bypassing += 1
            continue

        merged_via_queue += 1
        enqueue_count.append(len(adds))
        total_latency.append(hours_between(parse_ts(adds[0]["createdAt"]), merged_at))
        first_pass_latency.append(
            hours_between(parse_ts(adds[-1]["createdAt"]), merged_at)
        )

    window_h = hours_between(window_start, window_end)
    first_pass_wins = sum(1 for n in enqueue_count if n == 1)
    non_merge_dequeues = sum(n for r, n in reasons.items() if r != MERGE_REASON)

    return {
        "window_h": window_h,
        "merged_total": merged_via_queue + merged_bypassing,
        "merged_via_queue": merged_via_queue,
        "merged_bypassing": merged_bypassing,
        "total_p50_h": percentile(total_latency, 0.50),
        "total_p90_h": percentile(total_latency, 0.90),
        "first_pass_p50_h": percentile(first_pass_latency, 0.50),
        "first_pass_p90_h": percentile(first_pass_latency, 0.90),
        "requeue_penalty_h": (
            percentile(total_latency, 0.50) - percentile(first_pass_latency, 0.50)
            if total_latency and first_pass_latency
            else None
        ),
        "first_pass_rate": (
            first_pass_wins / merged_via_queue if merged_via_queue else None
        ),
        "enqueues_per_merge": (
            sum(enqueue_count) / merged_via_queue if merged_via_queue else None
        ),
        "wasted_passes": sum(enqueue_count) - merged_via_queue,
        "dequeue_reasons": reasons,
        "non_merge_dequeues": non_merge_dequeues,
        "throughput_per_h": merged_via_queue / window_h if window_h else None,
        "failed_commits": failed_commits,
        "sample_size": merged_via_queue,
    }


def projected_drain_h(
    depth: int | None, throughput_per_h: float | None
) -> float | None:
    """Honest drain estimate: queue depth over the rate actually observed. Replaces
    GitHub's projection, which assumes a first-pass merge for every entry."""
    if not depth or not throughput_per_h:
        return None
    return depth / throughput_per_h


def shorten_check_name(name: str) -> str:
    """Collapse a matrix job's parameter list to its first entry — the shard id.

    Raw names arrive as `playwright / playwright-ci (chromium-05, chromium-05.json, 3,
    chromium, false)`, which is unreadable in a Slack line. Same reduction as the
    `sed 's/ (\\([^,)]*\\)[^)]*)/ (\\1)/'` in merge-queue-dequeue-report.yml.
    """
    return re.sub(r" \(([^,)]*)[^)]*\)", r" (\1)", name)


def sanitize_external(text: str) -> str:
    """Neutralise Slack markup in a string that did not originate in this repo.

    Check-run names are attacker-influenceable: a merge-group commit runs the workflows
    *in* the merge group, so a PR can introduce a job whose name carries markup, and any
    app with `checks:write` can name a run freely. Rendered raw into Slack mrkdwn a
    backtick closes the code span we wrap it in, `<url|text>` becomes a link, and
    `<!channel>` a broadcast. Slack's guidance is to escape & < > ; the backtick is ours.
    """
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("`", "'")
    )


def paginated_items(path: str, key: str, token: str, max_pages: int = 10) -> list[dict]:
    items = []
    separator = "&" if "?" in path else "?"
    for page in range(1, max_pages + 1):
        payload = rest(f"{path}{separator}per_page=100&page={page}", token)
        batch = payload.get(key, [])
        items.extend(batch)
        if len(batch) < 100 or len(items) >= payload.get("total_count", float("inf")):
            return items
    raise ApiError(f"Partial data: {path} exceeded {max_pages} pages")


def commit_checks(oid: str, owner: str, repo: str, token: str) -> list[dict]:
    try:
        return paginated_items(
            f"/repos/{owner}/{repo}/commits/{oid}/check-runs", "check_runs", token
        )
    except ApiError as exc:
        if exc.status in (401, 403):
            raise CheckAccessError(
                f"Cannot read check runs: {exc}", exc.status
            ) from exc
        if exc.status == 404:
            return []
        raise


def classify_check_evidence(checks: Sequence[dict]) -> dict:
    direct = {}
    cancelled = 0
    for check in checks:
        conclusion = check.get("conclusion")
        if conclusion == "cancelled":
            cancelled += 1
        if conclusion not in {
            "failure",
            "timed_out",
            "startup_failure",
            "action_required",
        }:
            continue
        url = check.get("details_url") or check.get("html_url") or ""
        run_match = re.search(r"/actions/runs/(\d+)", url)
        run_id = int(run_match.group(1)) if run_match else None
        name = check["name"]
        family = (
            "Playwright E2E"
            if "playwright" in name.lower()
            else shorten_check_name(name)
        )
        # A workflow's job, test reporter and required summary describe one failure incident.
        identity = run_id or check.get("check_suite", {}).get("id") or family
        evidence = {
            "check": sanitize_external(family),
            "jobUrl": url,
            "runId": run_id,
            "conclusion": conclusion,
        }
        if identity not in direct or "summary" not in name.lower():
            direct[identity] = evidence
    return {"directFailures": list(direct.values()), "cancelled": cancelled}


def top_failing_checks(
    commits: Sequence[str], owner: str, repo: str, token: str, limit: int = 5
) -> list[tuple[str, int]]:
    tally: dict[str, int] = {}
    for oid in dict.fromkeys(commits):
        evidence = classify_check_evidence(commit_checks(oid, owner, repo, token))
        for failure in evidence["directFailures"]:
            name = failure["check"]
            tally[name] = tally.get(name, 0) + 1
    return sorted(tally.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]


def read_summary_artifact(
    run_id: int, owner: str, repo: str, token: str, attempt: int = 1
) -> dict | None:
    artifacts = paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", "artifacts", token
    )
    name = f"playwright-shadow-gate-postgresql-pr-{run_id}-{attempt}"
    candidates = [
        artifact
        for artifact in artifacts
        if artifact["name"] == name and not artifact.get("expired")
    ]
    if not candidates:
        return None
    artifact = max(candidates, key=lambda value: value["id"])
    if artifact.get("size_in_bytes", 0) > 2 * 1024 * 1024:
        raise ApiError(f"Oversized summary artifact in run {run_id}")

    # gh handles the authenticated API -> signed blob redirect without exposing tokens.
    def download():
        try:
            completed = subprocess.run(
                [
                    "gh",
                    "api",
                    f"repos/{owner}/{repo}/actions/artifacts/{artifact['id']}/zip",
                ],
                env={**os.environ, "GH_TOKEN": token},
                capture_output=True,
                timeout=30,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise ApiError(f"Summary download timed out for run {run_id}") from exc
        if completed.returncode:
            raise ApiError(f"Summary download failed for run {run_id}")
        return completed.stdout

    archive_bytes = _retrying(download)
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        member = archive.getinfo("outcome.json")
        if member.file_size > 8 * 1024 * 1024:
            raise ApiError(f"Oversized summary JSON in run {run_id}")
        report = json.loads(archive.read(member))
    if (
        not isinstance(report, dict)
        or report.get("schemaVersion") != 1
        or not isinstance(report.get("counts"), dict)
    ):
        raise ApiError(f"Invalid summary in run {run_id}")
    if not isinstance(report.get("failures", []), list) or not all(
        isinstance(failure, dict) and isinstance(failure.get("title"), str)
        for failure in report.get("failures", [])
    ):
        raise ApiError(f"Invalid failure records in run {run_id}")
    for failure in report.get("failures", []):
        failure["error"] = failure.get("firstError", "")
    return report


def aggregate_test_reports(reports: Sequence[dict | None]) -> dict:
    totals = {
        key: 0
        for key in [
            "firstAttemptPassed",
            "firstAttemptFailed",
            "retriedTests",
            "quarantinedTests",
            "skippedTests",
            "missingReports",
            "legacyReports",
            "quarantineUnknownReports",
            "unverifiedCoverageReports",
            "unverifiedIntegrityReports",
        ]
    }
    for report in reports:
        if report is None:
            totals["missingReports"] += 1
            continue
        measurement = report.get("measurement")
        if not measurement:
            totals["legacyReports"] += 1
            continue
        if measurement.get("quarantinedTests") is None:
            totals["quarantineUnknownReports"] += 1
        if measurement.get("coverageVerified") is not True:
            totals["unverifiedCoverageReports"] += 1
        if measurement.get("artifactIntegrityVerified") is not True:
            totals["unverifiedIntegrityReports"] += 1
        for key in totals.keys() - {
            "missingReports",
            "legacyReports",
            "quarantineUnknownReports",
            "unverifiedCoverageReports",
            "unverifiedIntegrityReports",
        }:
            value = measurement.get(key)
            if isinstance(value, int) and value >= 0:
                totals[key] += value
    return totals


def failure_signature(error: str) -> str:
    value = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", error)
    value = re.sub(
        r"(?im)(authorization|cookie|set-cookie|x-api-key)\s*[:=][^\r\n]*",
        r"\1: <redacted>",
        value,
    )
    value = re.sub(
        r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "<redacted>", value
    )
    value = re.sub(
        r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", "<uuid>", value
    )
    return sanitize_external(value.split("\n")[0][:180])


def queue_failure_details(
    commits: Sequence[str], owner: str, repo: str, token: str
) -> list[dict]:
    details = []
    for oid in dict.fromkeys(commits):
        evidence = classify_check_evidence(commit_checks(oid, owner, repo, token))
        details.append({"sha": oid, **evidence})
    return details


def playwright_window_reports(
    owner: str, repo: str, token: str, start: datetime, end: datetime
) -> tuple[list[dict], list[str]]:
    query = urlencode(
        {"event": "merge_group", "created": f"{start.isoformat()}..{end.isoformat()}"}
    )
    runs = paginated_items(
        f"/repos/{owner}/{repo}/actions/workflows/playwright-postgresql-e2e.yml/runs?{query}",
        "workflow_runs",
        token,
    )
    warnings = []

    def collect(run):
        try:
            report = read_summary_artifact(run["id"], owner, repo, token)
            if report and report.get("context", {}).get("sourceSha") != run["head_sha"]:
                raise ApiError(f"Summary commit mismatch in run {run['id']}")
            return {
                "runId": run["id"],
                "sha": run["head_sha"],
                "conclusion": run["conclusion"],
                "attempts": run.get("run_attempt", 1),
                "createdAt": run["created_at"],
                "report": report,
            }, None
        except (
            ApiError,
            OSError,
            ValueError,
            KeyError,
            zipfile.BadZipFile,
            subprocess.TimeoutExpired,
        ) as exc:
            return {
                "runId": run["id"],
                "sha": run["head_sha"],
                "conclusion": run["conclusion"],
                "attempts": run.get("run_attempt", 1),
                "report": None,
            }, str(exc)

    with ThreadPoolExecutor(max_workers=6) as pool:
        collected = list(pool.map(collect, runs))
    for _, warning in collected:
        if warning:
            warnings.append(warning)
    return [record for record, _ in collected], warnings


# -------------------------------------------------------------------- formatting


def fmt_h(value: float | None, precision: int = 1) -> str:
    return "n/a" if value is None else f"{value:.{precision}f}h"


def fmt_pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.0f}%"


def fmt_rate(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.2f}/h"


def delta_marker(
    current: float | None, baseline: float | None, lower_is_better: bool = True
) -> str:
    """Direction against a reference window. Deliberately has no threshold — the daily
    report always posts and lets the reader judge, so there is no fire/don't-fire call
    to get wrong."""
    if current is None or baseline is None or baseline == 0:
        return ""
    change = (current - baseline) / baseline * 100
    if abs(change) < 5:
        return " (flat)"
    worse = change > 0 if lower_is_better else change < 0
    return f" ({'+' if change > 0 else ''}{change:.0f}%{' ⚠️' if worse else ' ✅'})"


def env_token() -> str:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("GH_TOKEN (or GITHUB_TOKEN) must be set")
    return token


def require_channel(value: str) -> str:
    """An unset `vars.MQ_SLACK_CHANNEL` expands to an empty string, which argparse
    accepts and Slack rejects as `invalid_arguments` — fail here with the cause."""
    if not value.strip():
        raise SystemExit(
            "--channel is empty; set the MQ_SLACK_CHANNEL repository variable"
        )
    return value.strip()


def window(now: datetime, hours: float) -> tuple[datetime, datetime]:
    return now - timedelta(hours=hours), now


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
