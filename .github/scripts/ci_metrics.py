#!/usr/bin/env python3
"""Measured numbers for the CI redesign: what CI costs and decides today, and how
ci.yml compares while it runs in shadow. Never projections.

  baseline  the current CI over a window:
              merge queue      full count from PR timelines: merges, enqueues per
                               merged PR, enqueue→merge latency with and without a
                               failed_checks removal, dequeue reasons
              false ejections  full count: failed_checks / merge_conflict removals
                               after which the PR merged with the very same head
              CI cost          a deterministic sample of PR heads and merge groups:
                               workflow runs, job-minutes, wall-clock and runner
                               queue time over every attempt
              static waste     test job-minutes spent on sampled PR heads whose
                               java/ui/py checkstyle failed — work a static gate
                               would not have started
  compare   the shadow period: for sampled commits where the old workflows and
            ci.yml both ran, whether the old required checks, the ci.yml run and
            the `merge-gate (shadow)` status agree, and what each side cost. A
            ci.yml run its own shadow sampling skipped ("Not sampled") tested
            nothing and is left out, not scored as a pass.

Both write metrics.json and metrics.md to --out. Every figure names its window;
every sampled figure names its n and the population it was drawn from.

Three API behaviours shape the method:

  1. ``RemovedFromMergeQueueEvent.beforeCommit`` is the merge-group commit, not the
     PR head. Measured: on a ``merged`` removal it equals the PR's ``mergeCommit``,
     whose only parent is the previous main, and a ``failed_checks`` one names a
     commit whose runs are all ``merge_group`` runs on ``gh-readonly-queue/…``. Two
     passes of identical code never share it. The head a pass was built from is the
     PR head when the PR was added to the queue, read from the runs of a workflow
     that runs once per PR push (``--push-anchor``): heads replaced by a force-push
     vanish from the PR's own commit list and timeline, but not from its runs.
  2. GitHub returns at most 1,000 matches per search and 1,000 runs per filtered
     listing, without an error. Both are read in slices, and a slice that still
     overflows is reported as partial instead of being counted as complete.
  3. ``/actions/runs/{id}/timing`` reports 0 billable ms for a public repository.
     Job-minutes are summed from each job's started_at..completed_at instead, over
     every attempt (``jobs?filter=all``), for jobs that reached a runner — once per
     execution, because a re-run of failed jobs lists the jobs it did not re-run
     again under the new attempt.

Sampling keeps the REST budget (5,000/hour, shared) bounded: a sampled commit costs
one runs listing plus one jobs listing per run that was not skipped. metrics.json
records the calls actually made.

Exits:
  0 — report written; anything read only partly is listed under its warnings
  1 — nothing could be measured (bad token, API down, invalid window)
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import threading
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import merge_queue_metrics as mq

SCHEMA_VERSION = 1

# Runs on every PR push (opened, synchronize, reopened) with no path, branch or draft
# filter, so its runs are a complete push log for every PR, forks included.
PUSH_ANCHOR = "team-labeler.yml"
# Runs exactly once on every merge group, unfiltered: its merge_group runs enumerate
# the groups the queue built, one run per group rather than one per workflow.
MERGE_GROUP_ANCHOR = "java-checkstyle.yml"
PR_EVENTS = frozenset({"pull_request", "pull_request_target"})
MERGE_GROUP_EVENTS = frozenset({"merge_group"})
EJECTION_REASONS = ("failed_checks", "merge_conflict")

FAILED = frozenset({"failure", "timed_out", "startup_failure"})
# GitHub counts a skipped or neutral required check as passing.
GREEN = frozenset({"success", "neutral", "skipped"})
STATIC_CHECK = re.compile(r"java-checkstyle|ui-checkstyle|py-checkstyle")
STATIC_WORKFLOWS = frozenset({"java-checkstyle.yml", "ui-checkstyle.yml", "py-checkstyle.yml"})
# Builds and test suites: what a static gate holds back. Labelling, PR metadata,
# security scans and harness checks run regardless, so they are never counted as waste.
TEST_WORKFLOW = re.compile(r"test|integration|playwright|e2e|coverage|maven|sonar")
# Required on main by the ruleset on 2026-10-13 (GET /repos/{o}/{r}/rules/branches/main).
# Pinned, not read live: once the gate enforces, the ruleset requires `merge-gate`
# instead, and "the old verdict" must keep meaning the same eight checks.
OLD_REQUIRED_CHECKS = (
    "java-checkstyle",
    "py-checkstyle",
    "ui-checkstyle",
    "ui-coverage",
    "py-tests-status",
    "playwright-summary",
    "integration-tests-mysql-elasticsearch",
    "integration-tests-postgres-opensearch",
)
SHADOW_CONTEXT = "merge-gate (shadow)"  # merge-gate/policy.json shadowStatusContext
# ci.yml's `plan` job runs this step, successfully, when the shadow sample leaves a
# commit out: every other job is skipped and the gate posts no status.
PLAN_JOB = "plan"
NOT_SAMPLED_STEP = "Not sampled"
QUEUE_REF = re.compile(r"^gh-readonly-queue/(?P<base>.+)/pr-(?P<pr>\d+)-[0-9a-f]{40}$")

PASS, FAIL, PENDING, CANCELLED, ABSENT = "pass", "fail", "pending", "cancelled", "absent"
DECIDED = (PASS, FAIL)
UNCHANGED = "mergedUnchanged"
CHANGED = "mergedAfterHeadChange"
NEVER_MERGED = "neverMerged"
HEAD_UNKNOWN = "headUnknown"
OUTCOMES = (UNCHANGED, CHANGED, NEVER_MERGED, HEAD_UNKNOWN)

DEFAULT_SAMPLE = 30
MAX_SAMPLE = 200
MAX_WINDOW = timedelta(days=31)
# The PR search reads every PR updated since --since, so how far back it may start
# bounds the read as much as the window length does.
MAX_LOOKBACK = timedelta(days=90)
# Runs of the last hours are still finishing; sampling their commits would count the
# cost of half a pipeline.
SETTLE = timedelta(hours=3)
SEARCH_SLICE = timedelta(days=1)
LIST_SLICE = timedelta(days=1)
MIN_LIST_SLICE = timedelta(hours=1)
LIST_MAX_PAGES = 10
PUSH_LOG_MAX_PAGES = 3
CLOCK_SLACK = timedelta(minutes=1)
MAX_DETAIL_ROWS = 200
WORKERS = 6

PR_HISTORY_QUERY = """
query($q: String!, $cursor: String, $pageSize: Int!, $events: Int!) {
  search(query: $q, type: ISSUE, first: $pageSize, after: $cursor) {
    issueCount
    pageInfo { endCursor hasNextPage }
    nodes {
      ... on PullRequest {
        number
        url
        merged
        mergedAt
        createdAt
        closedAt
        isDraft
        headRefName
        headRefOid
        headRepository { nameWithOwner }
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
        drafts: timelineItems(
          first: $events, itemTypes: [READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT]
        ) {
          nodes {
            __typename
            ... on ReadyForReviewEvent { createdAt }
            ... on ConvertToDraftEvent { createdAt }
          }
        }
      }
    }
  }
}
"""


class ApiCalls:
    """Requests this run made. Counted on mq.rest, which paginated_items calls once per
    page, and on mq.graphql — every request passes through one of the two."""

    def __init__(self) -> None:
        self.rest = 0
        self.graphql = 0
        self._lock = threading.Lock()

    @contextmanager
    def counting(self):
        rest, graphql = mq.rest, mq.graphql

        def counted_rest(path: str, token: str) -> Any:
            with self._lock:
                self.rest += 1
            return rest(path, token)

        def counted_graphql(query: str, variables: dict[str, Any], token: str) -> dict[str, Any]:
            with self._lock:
                self.graphql += 1
            return graphql(query, variables, token)

        mq.rest, mq.graphql = counted_rest, counted_graphql
        try:
            yield self
        finally:
            mq.rest, mq.graphql = rest, graphql


# ------------------------------------------------------------------------ helpers


def stamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_bound(value: str, end_of_day: bool = False) -> datetime:
    """A `YYYY-MM-DD` bound or an ISO time. A bare end date is inclusive, as in
    merge_queue_daily_report: `--until 2026-10-13` runs to the end of the 13th."""
    if len(value) == 10:
        start = mq.parse_ts(f"{value}T00:00:00Z")
        return start + timedelta(days=1, microseconds=-1) if end_of_day else start
    parsed = mq.parse_ts(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def measurement_window(since: str, until: str, now: datetime) -> tuple[datetime, datetime]:
    start = parse_bound(since)
    end = min(parse_bound(until, end_of_day=True), now)
    if start >= end:
        raise ValueError(f"--since {since} must be before --until {until} and before now")
    if end - start > MAX_WINDOW:
        raise ValueError(f"the window is over {MAX_WINDOW.days} days; measure it in parts")
    if now - start > MAX_LOOKBACK:
        raise ValueError(
            f"--since is over {MAX_LOOKBACK.days} days ago; the PR search would read "
            "every PR updated since then"
        )
    return start, end


def rnd(value: float | None, digits: int = 1) -> float | None:
    return None if value is None else round(value, digits)


def stats(values: Sequence[float], digits: int = 1) -> dict[str, Any]:
    """An empty sample reads None, never 0: no data is not a measurement of zero."""
    return {
        "n": len(values),
        "p50": rnd(mq.percentile(values, 0.50), digits),
        "p90": rnd(mq.percentile(values, 0.90), digits),
        "max": rnd(max(values), digits) if values else None,
        "mean": rnd(statistics.fmean(values), digits) if values else None,
    }


def _nodes(pr: dict[str, Any], key: str) -> list[dict[str, Any]]:
    # nodes, never totalCount — merge_queue_metrics' module docstring explains why.
    return (pr.get(key) or {}).get("nodes") or []


def workflow_file(run: dict[str, Any]) -> str:
    return Path(run.get("path") or "unknown").name


def run_pr(run: dict[str, Any]) -> int | None:
    if match := QUEUE_REF.match(run.get("head_branch") or ""):
        return int(match["pr"])
    pulls = run.get("pull_requests") or []
    return pulls[0].get("number") if pulls else None


def event_family(event: str | None) -> frozenset[str]:
    """Runs comparable with a run of `event`: a PR head is tested by both PR events, and
    a merged group's commit later collects post-merge `push` runs that are not queue CI."""
    if event in PR_EVENTS:
        return PR_EVENTS
    return frozenset({event or "unknown"})


def in_parallel(work: Callable[[Any], Any], items: Iterable[Any]) -> list[Any]:
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return list(pool.map(work, items))


# ------------------------------------------------------------------ PR history


def _search(query: str, token: str) -> tuple[list[dict[str, Any]], bool]:
    nodes: list[dict[str, Any]] = []
    cursor = None
    for _ in range(mq.MAX_SEARCH_PAGES):
        page = mq.graphql(
            PR_HISTORY_QUERY,
            {
                "q": query,
                "cursor": cursor,
                "pageSize": mq.SEARCH_PAGE_SIZE,
                "events": mq.MAX_QUEUE_EVENTS_PER_PR,
            },
            token,
        )["search"]
        nodes.extend(node for node in page["nodes"] if node)
        if not page["pageInfo"]["hasNextPage"]:
            return nodes, len(nodes) >= page["issueCount"]
        cursor = page["pageInfo"]["endCursor"]
    return nodes, False


def fetch_pr_history(
    owner: str, repo: str, branch: str, since: datetime, now: datetime, token: str
) -> tuple[list[dict[str, Any]], bool]:
    """PRs to `branch` updated since `since`: the fields of mq.HISTORY_QUERY, so
    mq.realized_metrics reads them unchanged, plus head, draft history and dates.

    Read in one-day slices of `updated:`; one search of a long window would stop at
    1,000 PRs. The last slice is open-ended and read last, because a PR updated while
    this runs can only move into it.
    """
    prs: dict[int, dict[str, Any]] = {}
    truncated = False
    start = since
    while True:
        end = start + SEARCH_SLICE
        bounds = f"{stamp(start)}..{stamp(end)}" if end < now else f">={stamp(start)}"
        nodes, complete = _search(f"repo:{owner}/{repo} is:pr base:{branch} updated:{bounds}", token)
        truncated = truncated or not complete
        # `a..b` includes both ends, so a PR updated on a boundary second is read twice.
        prs.update((node["number"], node) for node in nodes)
        if end >= now:
            return sorted(prs.values(), key=lambda pr: pr["number"]), truncated
        start = end


# ------------------------------------------------------------------ merge queue


def merged_via_queue(pr: dict[str, Any], start: datetime, end: datetime) -> bool:
    """The PRs mq.realized_metrics counts as merged via the queue."""
    return bool(
        pr.get("merged")
        and pr.get("mergedAt")
        and _nodes(pr, "adds")
        and start <= mq.parse_ts(pr["mergedAt"]) <= end
    )


def queue_section(prs: Sequence[dict[str, Any]], start: datetime, end: datetime) -> dict[str, Any]:
    realized = mq.realized_metrics(prs, start, end)
    enqueues = [len(_nodes(pr, "adds")) for pr in prs if merged_via_queue(pr, start, end)]
    # The PR's whole queue history counts: its enqueue→merge latency spans it.
    ejected = {
        pr["number"]
        for pr in prs
        if any(removal.get("reason") == "failed_checks" for removal in _nodes(pr, "removals"))
    }

    def latency(metrics: dict[str, Any]) -> dict[str, Any]:
        return {
            "n": metrics["sample_size"],
            "p50": rnd(metrics["total_p50_h"], 2),
            "p90": rnd(metrics["total_p90_h"], 2),
        }

    def latency_of(group: list[dict[str, Any]]) -> dict[str, Any]:
        return latency(mq.realized_metrics(group, start, end))

    return {
        "mergedViaQueue": realized["merged_via_queue"],
        # realized_metrics counts every merged PR that was ever queued; these left the
        # queue for good and were merged outside it.
        "mergedViaQueueWithoutMergedRemoval": sum(
            1
            for pr in prs
            if merged_via_queue(pr, start, end)
            and not any(r.get("reason") == mq.MERGE_REASON for r in _nodes(pr, "removals"))
        ),
        "mergedBypassingQueue": realized["merged_bypassing"],
        "enqueuesPerMergedPr": {
            "n": len(enqueues),
            "mean": rnd(realized["enqueues_per_merge"], 2),
            "median": statistics.median(enqueues) if enqueues else None,
        },
        "enqueueToMergeHours": {
            "all": latency(realized),
            "withFailedChecksRemoval": latency_of([pr for pr in prs if pr["number"] in ejected]),
            "withoutFailedChecksRemoval": latency_of(
                [pr for pr in prs if pr["number"] not in ejected]
            ),
        },
        "dequeueReasons": dict(
            sorted(realized["dequeue_reasons"].items(), key=lambda kv: (-kv[1], kv[0]))
        ),
    }


# -------------------------------------------------------------- false ejections


def find_ejections(
    prs: Sequence[dict[str, Any]], start: datetime, end: datetime
) -> list[dict[str, Any]]:
    """Every failed_checks / merge_conflict removal in the window, with the queue add
    that started the ejected pass — the merge group was built from the head then."""
    found = []
    for pr in prs:
        added = sorted(mq.parse_ts(node["createdAt"]) for node in _nodes(pr, "adds"))
        for removal in _nodes(pr, "removals"):
            removed = mq.parse_ts(removal["createdAt"])
            if removal.get("reason") not in EJECTION_REASONS or not start <= removed <= end:
                continue
            found.append(
                {
                    "pr": pr,
                    "reason": removal["reason"],
                    "removedAt": removed,
                    "passStartedAt": max((t for t in added if t <= removed), default=removed),
                    "requeued": any(t > removed for t in added),
                }
            )
    return sorted(found, key=lambda e: (e["removedAt"], e["pr"]["number"]))


def push_log(
    owner: str, repo: str, pr: dict[str, Any], anchor: str, token: str
) -> list[tuple[datetime, str]] | None:
    """(time, head) of each push to the PR, oldest first, from the anchor's runs. None
    when the PR's head repository is gone: its branch name alone could be any fork's."""
    head_repo = (pr.get("headRepository") or {}).get("nameWithOwner")
    if not head_repo or not pr.get("headRefName"):
        return None
    opened = mq.parse_ts(pr["createdAt"]) - CLOCK_SLACK
    path = f"/repos/{owner}/{repo}/actions/workflows/{anchor}/runs?" + urlencode(
        {"branch": pr["headRefName"], "per_page": 100}
    )
    log = []
    for page in range(1, PUSH_LOG_MAX_PAGES + 1):
        runs = mq.rest(f"{path}&page={page}", token).get("workflow_runs") or []
        for run in runs:
            at = mq.parse_ts(run["created_at"])
            # Same branch name in another fork, or an earlier PR from this branch.
            if at >= opened and (run.get("head_repository") or {}).get("full_name") == head_repo:
                log.append((at, run["head_sha"]))
        # Newest first: once a page reaches back past the PR's creation, older pages
        # hold only other PRs. A log cut short here still answers exactly for every
        # time after its oldest entry, and None before it.
        if len(runs) < 100 or mq.parse_ts(runs[-1]["created_at"]) < opened:
            break
    return sorted(log)


def push_logs(
    owner: str, repo: str, prs: Sequence[dict[str, Any]], anchor: str, token: str
) -> tuple[dict[int, list[tuple[datetime, str]] | None], list[str]]:
    def read(pr: dict[str, Any]) -> tuple[int, list[tuple[datetime, str]] | None, str | None]:
        try:
            return pr["number"], push_log(owner, repo, pr, anchor, token), None
        except mq.ApiError as exc:
            return pr["number"], None, f"push log of PR #{pr['number']} unreadable: {exc}"

    results = in_parallel(read, prs)
    return (
        {number: log for number, log, _ in results},
        [error for _, _, error in results if error],
    )


def head_at(log: Sequence[tuple[datetime, str]], when: datetime) -> str | None:
    """The head at `when`: the last push at or before it."""
    head = None
    for at, sha in log:
        if at > when:
            break
        head = sha
    return head


def classify_ejection(
    ejection: dict[str, Any], log: Sequence[tuple[datetime, str]] | None
) -> tuple[str, str | None]:
    pr = ejection["pr"]
    head = head_at(log, ejection["passStartedAt"]) if log else None
    if not pr.get("merged"):
        return NEVER_MERGED, head
    if head is None:
        return HEAD_UNKNOWN, None
    return (UNCHANGED if head == pr.get("headRefOid") else CHANGED), head


def ejection_section(
    found: Sequence[dict[str, Any]], logs: dict[int, list[tuple[datetime, str]] | None]
) -> dict[str, Any]:
    by_reason = {reason: Counter() for reason in EJECTION_REASONS}
    # Merged without another pass: an admin merged the PR outside the queue.
    outside: Counter[str] = Counter()
    details = []
    for ejection in found:
        pr = ejection["pr"]
        outcome, head = classify_ejection(ejection, logs.get(pr["number"]))
        by_reason[ejection["reason"]][outcome] += 1
        if pr.get("merged") and not ejection["requeued"]:
            outside[outcome] += 1
        details.append(
            {
                "pr": pr["number"],
                "url": pr.get("url"),
                "reason": ejection["reason"],
                "removedAt": stamp(ejection["removedAt"]),
                "passStartedAt": stamp(ejection["passStartedAt"]),
                "ejectedHead": head,
                "finalHead": pr.get("headRefOid") if pr.get("merged") else None,
                "mergedAt": pr.get("mergedAt"),
                "requeued": ejection["requeued"],
                "outcome": outcome,
            }
        )
    totals: Counter[str] = Counter()
    for counts in by_reason.values():
        totals.update(counts)
    return {
        "total": len(found),
        "outcomes": {outcome: totals[outcome] for outcome in OUTCOMES},
        "byReason": {
            reason: {outcome: counts[outcome] for outcome in OUTCOMES}
            for reason, counts in by_reason.items()
        },
        "mergedOutsideQueue": {outcome: outside[outcome] for outcome in (UNCHANGED, CHANGED, HEAD_UNKNOWN)},
        "details": details[:MAX_DETAIL_ROWS],
        "detailsTruncated": len(details) > MAX_DETAIL_ROWS,
    }


# ------------------------------------------------------------------ populations


def list_runs(
    owner: str,
    repo: str,
    workflow: str,
    since: datetime,
    until: datetime,
    token: str,
    event: str = "",
) -> list[dict[str, Any]]:
    """Runs of one workflow created in [since, until], oldest first."""
    runs: dict[int, dict[str, Any]] = {}
    start = since
    while start < until:
        end = min(start + LIST_SLICE, until)
        for run in _list_slice(owner, repo, workflow, event, start, end, token):
            # `created=a..b` includes both ends, so neighbouring slices can share a run.
            runs[run["id"]] = run
        start = end
    return sorted(runs.values(), key=lambda run: (run["created_at"], run["id"]))


def _list_slice(
    owner: str,
    repo: str,
    workflow: str,
    event: str,
    start: datetime,
    end: datetime,
    token: str,
) -> list[dict[str, Any]]:
    params = {"created": f"{stamp(start)}..{stamp(end)}"}
    if event:
        params["event"] = event
    try:
        return mq.paginated_items(
            f"/repos/{owner}/{repo}/actions/workflows/{workflow}/runs?{urlencode(params)}",
            "workflow_runs",
            token,
            max_pages=LIST_MAX_PAGES,
        )
    except mq.ApiError as exc:
        # Over 1,000 runs in the slice: halve it rather than silently drop the rest.
        if "Partial data" not in str(exc) or end - start <= MIN_LIST_SLICE:
            raise
        middle = start + (end - start) / 2
        return _list_slice(owner, repo, workflow, event, start, middle, token) + _list_slice(
            owner, repo, workflow, event, middle, end, token
        )


def owning_pr(candidates: Sequence[dict[str, Any]], at: datetime) -> dict[str, Any] | None:
    """The PR a push to this branch belonged to: opened by then and not yet closed."""
    live = [
        pr
        for pr in candidates
        if mq.parse_ts(pr["createdAt"]) - CLOCK_SLACK <= at
        and (not pr.get("closedAt") or at <= mq.parse_ts(pr["closedAt"]) + CLOCK_SLACK)
    ]
    return max(live, key=lambda pr: pr["createdAt"], default=None)


def ready_during(pr: dict[str, Any], start: datetime, end: datetime) -> bool:
    """Whether the PR was ready for review at some moment in [start, end).

    A draft head marked ready without a new push still gets the full PR CI — the
    ready_for_review event runs it on that head — so draft at push time is not enough
    to leave a head out.
    """
    events = sorted(
        (mq.parse_ts(node["createdAt"]), node.get("__typename") == "ConvertToDraftEvent")
        for node in _nodes(pr, "drafts")
        if node.get("createdAt")
    )
    before = [draft_after for at, draft_after in events if at <= start]
    if before:
        draft = before[-1]
    elif events:
        # Not toggled yet: the first toggle says what the PR was before it.
        draft = not events[0][1]
    else:
        draft = bool(pr.get("isDraft"))
    return not draft or any(not draft_after for at, draft_after in events if start < at < end)


def pr_head_population(
    anchor_runs: Sequence[dict[str, Any]], prs: Sequence[dict[str, Any]], now: datetime
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """One candidate per PR head pushed in the window, kept when its PR targets the
    measured branch and was ready for review at some moment while it was the head."""
    by_branch: dict[tuple[str | None, str | None], list[dict[str, Any]]] = {}
    for pr in prs:
        key = ((pr.get("headRepository") or {}).get("nameWithOwner"), pr.get("headRefName"))
        by_branch.setdefault(key, []).append(pr)

    pushes: dict[int, list[tuple[datetime, str]]] = {}
    owners: dict[int, dict[str, Any]] = {}
    counts: Counter[str] = Counter()
    for run in anchor_runs:
        if run.get("event") not in PR_EVENTS:
            continue
        counts["anchorRuns"] += 1
        at = mq.parse_ts(run["created_at"])
        key = ((run.get("head_repository") or {}).get("full_name"), run.get("head_branch"))
        pr = owning_pr(by_branch.get(key, []), at)
        if pr is None:
            # A PR to another branch, or one the search did not return.
            counts["otherBase"] += 1
            continue
        pushes.setdefault(pr["number"], []).append((at, run["head_sha"]))
        owners[pr["number"]] = pr

    population: list[dict[str, Any]] = []
    seen: set[str] = set()
    for number in sorted(pushes):
        pr = owners[number]
        heads: list[tuple[datetime, str]] = []
        for at, sha in sorted(pushes[number]):
            if not heads or heads[-1][1] != sha:  # a reopen re-runs the same head
                heads.append((at, sha))
        for index, (at, sha) in enumerate(heads):
            if sha in seen:
                continue
            if index + 1 < len(heads):
                end = heads[index + 1][0]
            else:
                end = mq.parse_ts(pr["closedAt"]) if pr.get("closedAt") else now
            if not ready_during(pr, at, end):
                counts["draft"] += 1
                continue
            seen.add(sha)
            population.append({"sha": sha, "pr": number, "pushedAt": stamp(at)})
    population.sort(key=lambda candidate: (candidate["pushedAt"], candidate["sha"]))
    counts["eligible"] = len(population)
    return population, dict(sorted(counts.items()))


def merge_group_population(
    anchor_runs: Sequence[dict[str, Any]], branch: str
) -> list[dict[str, Any]]:
    """One candidate per merge-group commit on `branch`, first seen in the window. A
    re-run of the same group is the same commit."""
    first: dict[str, dict[str, Any]] = {}
    for run in sorted(anchor_runs, key=lambda run: (run["created_at"], run["id"])):
        match = QUEUE_REF.match(run.get("head_branch") or "")
        if run.get("event") != "merge_group" or not match or match["base"] != branch:
            continue
        first.setdefault(
            run["head_sha"],
            {
                "sha": run["head_sha"],
                "pr": int(match["pr"]),
                "pushedAt": stamp(mq.parse_ts(run["created_at"])),
            },
        )
    return sorted(first.values(), key=lambda candidate: (candidate["pushedAt"], candidate["sha"]))


def commits_of(runs: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """One candidate per commit a workflow ran on, with the event of its first run."""
    first: dict[str, dict[str, Any]] = {}
    for run in sorted(runs, key=lambda run: (run["created_at"], run["id"])):
        first.setdefault(
            run["head_sha"],
            {
                "sha": run["head_sha"],
                "pr": run_pr(run),
                "event": run.get("event"),
                "pushedAt": stamp(mq.parse_ts(run["created_at"])),
            },
        )
    return sorted(first.values(), key=lambda candidate: (candidate["pushedAt"], candidate["sha"]))


def every_kth(population: Sequence[dict[str, Any]], n: int) -> list[dict[str, Any]]:
    """Every k-th candidate in push order, k = population / n: spread across the whole
    window, and the same commits on every run over the same window."""
    if n <= 0:
        return []
    if len(population) <= n:
        return list(population)
    step = len(population) / n
    return [population[int(index * step)] for index in range(n)]


# ------------------------------------------------------------------- CI cost


def runs_for(owner: str, repo: str, sha: str, token: str) -> list[dict[str, Any]]:
    return mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs?head_sha={sha}", "workflow_runs", token
    )


def jobs_for(
    owner: str, repo: str, run: dict[str, Any], token: str, keep_skipped: bool = False
) -> list[dict[str, Any]]:
    """keep_skipped lists a skipped run's jobs too: a verdict needs them, because a
    skipped required check counts as passing. Cost does not — none reached a runner."""
    if run.get("conclusion") == "skipped" and not keep_skipped:
        return []
    # filter=all: every attempt, not just the latest — a re-run's first attempt was paid for.
    return mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/jobs?filter=all", "jobs", token
    )


def ran(job: dict[str, Any]) -> bool:
    """Reached a runner. A skipped job has none, and its completed_at can precede its
    started_at; a job cancelled while queued has none either."""
    return bool(
        job.get("status") == "completed"
        and job.get("conclusion") != "skipped"
        and job.get("runner_name")
        and job.get("started_at")
        and job.get("completed_at")
    )


def executions(jobs: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Jobs that reached a runner, each execution once. Re-running failed jobs copies
    every job it does not re-run into the new attempt with the original runner and
    timestamps (measured on run 38404498223); summed per attempt they would bill twice.
    The earliest attempt's copy is kept, so first-attempt figures stay first-attempt."""
    seen: set[tuple[Any, ...]] = set()
    unique = []
    for job in sorted(jobs, key=lambda job: (int(job.get("run_attempt") or 1), job.get("id") or 0)):
        key = tuple(job.get(field) for field in ("run_id", "name", "runner_name", "started_at", "completed_at"))
        if ran(job) and key not in seen:
            seen.add(key)
            unique.append(job)
    return unique


def _seconds(start: str, end: str) -> float:
    return max(0.0, (mq.parse_ts(end) - mq.parse_ts(start)).total_seconds())


def _span_minutes(starts: Sequence[datetime], ends: Sequence[datetime]) -> float | None:
    if not starts or not ends:
        return None
    return round((max(ends) - min(starts)).total_seconds() / 60, 1)


def latest_jobs(
    runs: Sequence[dict[str, Any]], jobs: Sequence[dict[str, Any]], wanted: Callable[[str], Any]
) -> dict[tuple[str, str], dict[str, Any]]:
    """The newest job per (workflow, name) among the wanted names: the attempt whose
    verdict stands. Keyed per workflow because two workflows can share a check name
    (`py-tests-status` comes from py-tests.yml and py-tests-postgres.yml)."""
    files = {run["id"]: workflow_file(run) for run in runs}
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for job in jobs:
        name = job.get("name") or ""
        if not wanted(name):
            continue
        key = (files.get(job.get("run_id"), "unknown"), name)
        order = (job.get("created_at") or "", job.get("id") or 0)
        if key not in latest or order > (latest[key].get("created_at") or "", latest[key].get("id") or 0):
            latest[key] = job
    return latest


def cost_record(
    runs: Sequence[dict[str, Any]], jobs: Sequence[dict[str, Any]]
) -> tuple[dict[str, Any], list[float]]:
    """One commit's cost over every attempt, and its jobs' runner queue times."""
    files = {run["id"]: workflow_file(run) for run in runs}
    done = executions(jobs)
    per_workflow: Counter[str] = Counter()
    for job in done:
        per_workflow[files.get(job.get("run_id"), "unknown")] += _seconds(
            job["started_at"], job["completed_at"]
        )
    queue = [_seconds(job["created_at"], job["started_at"]) for job in done if job.get("created_at")]
    created = [mq.parse_ts(run["created_at"]) for run in runs if run.get("created_at")]
    static = latest_jobs(runs, done, STATIC_CHECK.search)
    record = {
        "runs": len(runs),
        "attempts": sum(int(run.get("run_attempt") or 1) for run in runs),
        "jobsRun": len(done),
        "jobMinutes": round(sum(per_workflow.values()) / 60, 1),
        "jobMinutesByWorkflow": {
            name: round(seconds / 60, 1)
            for name, seconds in sorted(per_workflow.items(), key=lambda kv: (-kv[1], kv[0]))
        },
        # First run created → last job finished, re-runs included; the first-attempt
        # figure shows how much of it the re-runs added.
        "wallClockMinutes": _span_minutes(
            created, [mq.parse_ts(job["completed_at"]) for job in done]
        ),
        "firstAttemptWallClockMinutes": _span_minutes(
            created,
            [mq.parse_ts(job["completed_at"]) for job in done if int(job.get("run_attempt") or 1) == 1],
        ),
        "runnerQueueSeconds": {
            key: value for key, value in stats(queue, 0).items() if key in ("p50", "p90", "max")
        },
        "complete": all(run.get("status") == "completed" for run in runs),
        "staticFailures": sorted(
            {name for (_, name), job in static.items() if job.get("conclusion") in FAILED}
        ),
    }
    return record, queue


def measure_commit(
    owner: str, repo: str, candidate: dict[str, Any], events: frozenset[str], token: str
) -> tuple[dict[str, Any], list[float]]:
    base = {key: candidate.get(key) for key in ("sha", "pr", "pushedAt")}
    try:
        everything = runs_for(owner, repo, candidate["sha"], token)
        runs = [run for run in everything if run.get("event") in events]
        jobs = [job for run in runs for job in jobs_for(owner, repo, run, token)]
    except (mq.ApiError, KeyError, ValueError) as exc:
        return {**base, "error": str(exc)}, []
    record, queue = cost_record(runs, jobs)
    other = Counter(run.get("event") or "unknown" for run in everything if run.get("event") not in events)
    return {**base, **record, "otherEventRuns": dict(sorted(other.items()))}, queue


def cost_section(
    population: int, measured: Sequence[tuple[dict[str, Any], list[float]]]
) -> dict[str, Any]:
    """Aggregates over the sampled commits whose runs had all finished; the rest are
    counted, not averaged in."""
    records = [record for record, _ in measured]
    complete = [(record, queue) for record, queue in measured if record.get("complete")]
    done = [record for record, _ in complete]
    return {
        "population": population,
        "sampled": len(records),
        "every": rnd(population / len(records), 2) if records else None,
        "measured": len(done),
        "incomplete": sum(1 for r in records if "error" not in r and not r["complete"]),
        "unreadable": sum(1 for r in records if "error" in r),
        "runsPerCommit": stats([r["runs"] for r in done]),
        "attemptsPerCommit": stats([r["attempts"] for r in done]),
        "jobMinutesPerCommit": stats([r["jobMinutes"] for r in done]),
        "jobMinutesTotal": round(sum(r["jobMinutes"] for r in done), 1),
        "wallClockMinutes": stats(
            [r["wallClockMinutes"] for r in done if r["wallClockMinutes"] is not None]
        ),
        "firstAttemptWallClockMinutes": stats(
            [r["firstAttemptWallClockMinutes"] for r in done if r["firstAttemptWallClockMinutes"] is not None]
        ),
        "runnerQueueSeconds": stats([s for _, queue in complete for s in queue], 0),
        "commits": records,
    }


def static_waste(records: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """Test job-minutes on sampled PR heads whose last java/ui/py checkstyle verdict
    was a failure: a head that cannot merge as pushed, whose tests a static gate would
    never have started."""
    measured = [record for record in records if record.get("complete")]
    hits = []
    for record in measured:
        if not record["staticFailures"]:
            continue
        tests = {
            name: minutes
            for name, minutes in record["jobMinutesByWorkflow"].items()
            if name not in STATIC_WORKFLOWS and TEST_WORKFLOW.search(name)
        }
        hits.append(
            {
                "sha": record["sha"],
                "pr": record["pr"],
                "failedChecks": record["staticFailures"],
                "testJobMinutes": round(sum(tests.values()), 1),
                "byWorkflow": tests,
            }
        )
    sample_minutes = sum(record["jobMinutes"] for record in measured)
    wasted = round(sum(hit["testJobMinutes"] for hit in hits), 1)
    return {
        "measured": len(measured),
        "withStaticFailure": len(hits),
        "testJobMinutes": wasted,
        "shareOfSampleJobMinutes": round(wasted / sample_minutes, 3) if sample_minutes else None,
        "commits": hits,
    }


# --------------------------------------------------------------------- baseline


def baseline(
    args: argparse.Namespace, since: datetime, until: datetime, now: datetime, token: str
) -> dict[str, Any]:
    owner, repo, branch = args.owner, args.repo, args.branch
    warnings: list[str] = []
    prs, truncated = fetch_pr_history(owner, repo, branch, since, now, token)
    if truncated:
        warnings.append("the PR search hit a cap: queue and ejection counts undercount")

    found = find_ejections(prs, since, until)
    # Only a merged PR's ejections need a head; the push log is read for no other.
    merged = {e["pr"]["number"]: e["pr"] for e in found if e["pr"].get("merged")}
    logs, errors = push_logs(owner, repo, [merged[n] for n in sorted(merged)], args.push_anchor, token)
    warnings += errors

    settled = min(until, now - SETTLE)
    pr_population: list[dict[str, Any]] = []
    pr_counts: dict[str, int] = {}
    mg_population: list[dict[str, Any]] = []
    if settled > since and args.sample_shas:
        try:
            anchor_runs = list_runs(owner, repo, args.push_anchor, since, settled, token)
            pr_population, pr_counts = pr_head_population(anchor_runs, prs, now)
        except mq.ApiError as exc:
            warnings.append(f"PR heads could not be listed from {args.push_anchor}: {exc}")
        try:
            group_runs = list_runs(
                owner, repo, args.merge_group_anchor, since, settled, token, event="merge_group"
            )
            mg_population = merge_group_population(group_runs, branch)
        except mq.ApiError as exc:
            warnings.append(f"merge groups could not be listed from {args.merge_group_anchor}: {exc}")

    pr_measured = in_parallel(
        lambda c: measure_commit(owner, repo, c, PR_EVENTS, token),
        every_kth(pr_population, args.sample_shas),
    )
    mg_measured = in_parallel(
        lambda c: measure_commit(owner, repo, c, MERGE_GROUP_EVENTS, token),
        every_kth(mg_population, args.sample_shas),
    )
    for record, _ in pr_measured + mg_measured:
        if "error" in record:
            warnings.append(f"commit {record['sha']} unreadable: {record['error']}")

    pr_cost = {**cost_section(len(pr_population), pr_measured), "populationCounts": pr_counts}
    return {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "baseline",
        "repository": f"{owner}/{repo}",
        "branch": branch,
        "window": {
            "since": stamp(since),
            "until": stamp(until),
            "costSampleUntil": stamp(max(settled, since)),
            "measuredAt": stamp(now),
        },
        "anchors": {"prPushes": args.push_anchor, "mergeGroups": args.merge_group_anchor},
        "queue": {"prsRead": len(prs), "truncated": truncated, **queue_section(prs, since, until)},
        "ejections": ejection_section(found, logs),
        "ciCost": {
            "prHeads": pr_cost,
            "mergeGroups": cost_section(len(mg_population), mg_measured),
        },
        "staticCheckWaste": static_waste(pr_cost["commits"]),
        "warnings": warnings,
    }


# ---------------------------------------------------------------------- compare


def required_verdict(
    runs: Sequence[dict[str, Any]], jobs: Sequence[dict[str, Any]], required: Sequence[str]
) -> dict[str, Any]:
    """The old CI's verdict: the newest attempt of every required check is green."""
    latest = latest_jobs(runs, jobs, set(required).__contains__)
    present = {name for _, name in latest}
    pending, failed, cancelled = set(), set(), set()
    for (_, name), job in latest.items():
        if job.get("status") != "completed":
            pending.add(name)
        elif job.get("conclusion") == "cancelled":
            cancelled.add(name)
        elif job.get("conclusion") not in GREEN:
            failed.add(name)
    missing = [name for name in required if name not in present]
    if pending:
        verdict = PENDING
    elif failed:
        verdict = FAIL
    elif cancelled or any(run.get("conclusion") == "cancelled" for run in runs):
        # A superseded commit or an invalidated merge group: no verdict was reached,
        # and checks it never created are not failures.
        verdict = CANCELLED
    elif missing:
        # A required check that never reports blocks the merge as surely as a red one.
        verdict = FAIL
    else:
        verdict = PASS
    return {
        "verdict": verdict,
        "failed": sorted(failed),
        "missing": missing,
        "pending": sorted(pending),
        "cancelled": sorted(cancelled),
    }


def run_verdict(runs: Sequence[dict[str, Any]]) -> dict[str, Any]:
    latest = max(runs, key=lambda run: (run.get("created_at") or "", run["id"]))
    conclusion = latest.get("conclusion")
    if latest.get("status") != "completed":
        verdict = PENDING
    elif conclusion == "cancelled":
        verdict = CANCELLED
    else:
        verdict = PASS if conclusion in GREEN else FAIL
    return {"verdict": verdict, "conclusion": conclusion, "runId": latest["id"]}


def not_sampled(runs: Sequence[dict[str, Any]], jobs: Sequence[dict[str, Any]]) -> bool:
    """The newest ci.yml run tested nothing because the shadow sample left it out. Its
    conclusion is still success, so scoring it would count an empty run as a pass."""
    latest = max(runs, key=lambda run: (run.get("created_at") or "", run["id"]))
    plans = [job for job in jobs if job.get("run_id") == latest["id"] and job.get("name") == PLAN_JOB]
    plan = max(plans, key=lambda job: (job.get("created_at") or "", job.get("id") or 0), default=None)
    return plan is not None and any(
        step.get("name") == NOT_SAMPLED_STEP and step.get("conclusion") == "success"
        for step in plan.get("steps") or []
    )


def status_verdict(statuses: Sequence[dict[str, Any]], context: str) -> dict[str, Any]:
    # The statuses API lists newest first, so the first match is the standing state.
    for status in statuses:
        if status.get("context") == context:
            state = status.get("state")
            verdict = {"success": PASS, "failure": FAIL, "error": FAIL}.get(state, PENDING)
            return {"verdict": verdict, "state": state}
    return {"verdict": ABSENT, "state": None}


def pair_record(
    old_runs: Sequence[dict[str, Any]],
    old_jobs: Sequence[dict[str, Any]],
    new_runs: Sequence[dict[str, Any]],
    new_jobs: Sequence[dict[str, Any]],
    statuses: Sequence[dict[str, Any]],
    required: Sequence[str],
    context: str,
) -> dict[str, Any]:
    def side(cost: dict[str, Any]) -> dict[str, Any]:
        return {key: cost[key] for key in ("runs", "jobMinutes", "wallClockMinutes", "complete")}

    old_cost, _ = cost_record(old_runs, old_jobs)
    new_cost, _ = cost_record(new_runs, new_jobs)
    return {
        "old": {**required_verdict(old_runs, old_jobs, required), **side(old_cost)},
        "new": {**run_verdict(new_runs), **side(new_cost)},
        "gate": status_verdict(statuses, context),
    }


def measure_pair(
    owner: str,
    repo: str,
    candidate: dict[str, Any],
    old_workflows: frozenset[str],
    new_workflow: str,
    required: Sequence[str],
    context: str,
    token: str,
) -> dict[str, Any]:
    base = {key: candidate.get(key) for key in ("sha", "pr", "event", "pushedAt")}
    events = event_family(candidate.get("event"))
    try:
        runs = [
            run
            for run in runs_for(owner, repo, candidate["sha"], token)
            if run.get("event") in events
        ]
        old_runs = [run for run in runs if workflow_file(run) in old_workflows]
        new_runs = [run for run in runs if workflow_file(run) == new_workflow]
        if not old_runs or not new_runs:
            return {**base, "overlap": False}
        new_jobs = [job for run in new_runs for job in jobs_for(owner, repo, run, token)]
        if not_sampled(new_runs, new_jobs):
            return {**base, "overlap": False, "notSampled": True}
        old_jobs = [job for run in old_runs for job in jobs_for(owner, repo, run, token, True)]
        statuses = mq.rest(f"/repos/{owner}/{repo}/commits/{candidate['sha']}/statuses?per_page=100", token)
    except (mq.ApiError, KeyError, ValueError) as exc:
        return {**base, "overlap": None, "error": str(exc)}
    return {
        **base,
        "overlap": True,
        **pair_record(old_runs, old_jobs, new_runs, new_jobs, statuses, required, context),
    }


def agreement(pairs: Sequence[dict[str, Any]], side: str) -> dict[str, Any]:
    """Old verdict against one new verdict, over the commits where both decided."""
    matrix: Counter[tuple[str, str]] = Counter()
    undecided: Counter[str] = Counter()
    for pair in pairs:
        old, new = pair["old"]["verdict"], pair[side]["verdict"]
        if old in DECIDED and new in DECIDED:
            matrix[(old, new)] += 1
        else:
            undecided[f"{old}/{new}"] += 1
    decided = sum(matrix.values())
    agree = matrix[(PASS, PASS)] + matrix[(FAIL, FAIL)]
    return {
        "decided": decided,
        "agree": agree,
        "rate": round(agree / decided, 3) if decided else None,
        "oldPassNewPass": matrix[(PASS, PASS)],
        "oldPassNewFail": matrix[(PASS, FAIL)],
        "oldFailNewPass": matrix[(FAIL, PASS)],
        "oldFailNewFail": matrix[(FAIL, FAIL)],
        "undecided": dict(sorted(undecided.items())),
    }


def compare_cost(pairs: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """Cost of each side over the commits where both sides had finished."""
    done = [pair for pair in pairs if pair["old"]["complete"] and pair["new"]["complete"]]

    def side(name: str) -> dict[str, Any]:
        return {
            "jobMinutes": stats([pair[name]["jobMinutes"] for pair in done]),
            "jobMinutesTotal": round(sum(pair[name]["jobMinutes"] for pair in done), 1),
            "wallClockMinutes": stats(
                [pair[name]["wallClockMinutes"] for pair in done if pair[name]["wallClockMinutes"] is not None]
            ),
        }

    return {"commits": len(done), "old": side("old"), "new": side("new")}


def compare(
    args: argparse.Namespace, since: datetime, until: datetime, now: datetime, token: str
) -> dict[str, Any]:
    owner, repo = args.owner, args.repo
    old_workflows = frozenset(name.strip() for name in args.old_workflows.split(",") if name.strip())
    required = tuple(name.strip() for name in args.old_required_checks.split(",") if name.strip())
    warnings: list[str] = []
    settled = min(until, now - SETTLE)
    new_runs: list[dict[str, Any]] = []
    if settled > since:
        try:
            new_runs = list_runs(owner, repo, args.new_workflow, since, settled, token)
        except mq.ApiError as exc:
            if exc.status != 404:
                raise
            warnings.append(
                f"{args.new_workflow} is not a workflow of {owner}/{repo} yet (HTTP 404): "
                "nothing to compare"
            )
    # The gate decides merge-group entries and PR heads; a post-merge `push` run of
    # ci.yml has no old required-check verdict to agree with.
    decided_runs = [run for run in new_runs if run.get("event") in PR_EVENTS | MERGE_GROUP_EVENTS]
    population = commits_of(decided_runs)
    pairs = in_parallel(
        lambda c: measure_pair(
            owner, repo, c, old_workflows, args.new_workflow, required, args.shadow_context, token
        ),
        every_kth(population, args.sample_shas),
    )
    for pair in pairs:
        if pair.get("error"):
            warnings.append(f"commit {pair['sha']} unreadable: {pair['error']}")
    overlapping = [pair for pair in pairs if pair.get("overlap")]
    by_event: dict[str, list[dict[str, Any]]] = {}
    for pair in overlapping:
        by_event.setdefault("merge_group" if pair["event"] == "merge_group" else "pr", []).append(pair)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "compare",
        "repository": f"{owner}/{repo}",
        "branch": args.branch,
        "window": {
            "since": stamp(since),
            "until": stamp(until),
            "costSampleUntil": stamp(max(settled, since)),
            "measuredAt": stamp(now),
        },
        "oldWorkflows": sorted(old_workflows),
        "newWorkflow": args.new_workflow,
        "oldRequiredChecks": list(required),
        "shadowContext": args.shadow_context,
        "newWorkflowRuns": len(new_runs),
        "newWorkflowRunsOtherEvents": len(new_runs) - len(decided_runs),
        "population": len(population),
        "sampled": len(pairs),
        "every": rnd(len(population) / len(pairs), 2) if pairs else None,
        "overlap": len(overlapping),
        "notSampled": sum(1 for pair in pairs if pair.get("notSampled")),
        "unreadable": sum(1 for pair in pairs if pair.get("error")),
        "agreement": {
            "ciRun": agreement(overlapping, "new"),
            "shadowGate": agreement(overlapping, "gate"),
            "byEvent": {
                event: {"ciRun": agreement(group, "new"), "shadowGate": agreement(group, "gate")}
                for event, group in sorted(by_event.items())
            },
        },
        "cost": compare_cost(overlapping),
        "commits": pairs,
        "warnings": warnings,
    }


# -------------------------------------------------------------------- rendering


def fmt(value: Any, unit: str = "", digits: int = 1) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.{digits}f}{unit}"
    return f"{value}{unit}"


def human(value: str) -> str:
    return value.replace("T", " ")[:16]


def short(sha: str | None) -> str:
    return f"`{sha[:10]}`" if sha else "—"


def _values(values: Sequence[Any], unit: str = "", digits: int = 1) -> str:
    """`a / b unit`, or n/a for an empty sample."""
    if all(value is None for value in values):
        return "n/a"
    return " / ".join(fmt(value, "", digits) for value in values) + unit


def _p50_p90(sample: dict[str, Any], unit: str = "", digits: int = 1) -> str:
    return _values([sample["p50"], sample["p90"]], unit, digits)


def _window_line(report: dict[str, Any]) -> str:
    window = report["window"]
    return (
        f"Window **{human(window['since'])} → {human(window['until'])} UTC**; "
        f"measured {human(window['measuredAt'])} UTC. Sampled commits were first pushed by "
        f"{human(window['costSampleUntil'])} UTC, at least {SETTLE.seconds // 3600} h before "
        "the measurement, so their runs could finish."
    )


def _tail(report: dict[str, Any]) -> list[str]:
    lines = []
    if report["warnings"]:
        lines += ["", "### Warnings", ""]
        lines += [f"- {mq.sanitize_external(warning)}" for warning in report["warnings"][:20]]
    calls = report.get("apiCalls") or {}
    lines += ["", f"_API calls made: {calls.get('rest', 'n/a')} REST, {calls.get('graphql', 'n/a')} GraphQL._"]
    return lines


def render_baseline(report: dict[str, Any]) -> str:
    queue, ejections = report["queue"], report["ejections"]
    latency = queue["enqueueToMergeHours"]
    enqueues = queue["enqueuesPerMergedPr"]
    pr_cost, mg_cost = report["ciCost"]["prHeads"], report["ciCost"]["mergeGroups"]
    waste = report["staticCheckWaste"]
    since_day = report["window"]["since"][:10]
    lines = [
        f"## CI baseline — `{report['repository']}` `{report['branch']}`",
        "",
        _window_line(report),
        "Queue and ejection figures are full counts from PR timelines. CI cost figures "
        "come from a deterministic sample; every column states its n and population.",
        "",
    ]
    if report["warnings"]:
        lines += ["> ⚠️ **Partial data** — see Warnings at the end.", ""]
    lines += [
        f"### Merge queue — full count ({queue['prsRead']} PRs to `{report['branch']}` "
        f"updated since {since_day})",
        "",
        "| metric | value | n |",
        "|---|---|---|",
        f"| merged via queue (queued at least once) | {queue['mergedViaQueue']} | |",
        f"| … of which merged outside the queue after leaving it | "
        f"{queue['mergedViaQueueWithoutMergedRemoval']} | |",
        f"| merged bypassing the queue (never queued) | {queue['mergedBypassingQueue']} | |",
        f"| enqueues per merged PR, mean / median | {fmt(enqueues['mean'], digits=2)} / "
        f"{fmt(enqueues['median'])} | {enqueues['n']} PRs |",
        f"| enqueue → merge, p50 / p90 | {_p50_p90(latency['all'], ' h')} | {latency['all']['n']} PRs |",
        f"| … with ≥1 `failed_checks` removal | {_p50_p90(latency['withFailedChecksRemoval'], ' h')} "
        f"| {latency['withFailedChecksRemoval']['n']} PRs |",
        f"| … with none | {_p50_p90(latency['withoutFailedChecksRemoval'], ' h')} "
        f"| {latency['withoutFailedChecksRemoval']['n']} PRs |",
        "",
        "Removals in the window, by reason: "
        + (", ".join(f"`{r}` {n}" for r, n in queue["dequeueReasons"].items()) or "none"),
        "",
        f"### Ejections — full count ({ejections['total']} `failed_checks` / `merge_conflict` "
        "removals in the window)",
        "",
        "| outcome | failed_checks | merge_conflict | total |",
        "|---|---|---|---|",
    ]
    labels = {
        UNCHANGED: "merged later with the same head — **false ejection**",
        CHANGED: "merged after a head change",
        NEVER_MERGED: f"not merged as of {human(report['window']['measuredAt'])} UTC",
        HEAD_UNKNOWN: "merged, head at ejection unknown",
    }
    for outcome in OUTCOMES:
        by_reason = ejections["byReason"]
        lines.append(
            f"| {labels[outcome]} | {by_reason['failed_checks'][outcome]} | "
            f"{by_reason['merge_conflict'][outcome]} | {ejections['outcomes'][outcome]} |"
        )
    outside = ejections["mergedOutsideQueue"]
    lines += [
        "",
        f"Merged outside the queue after the ejection, with no further pass: {outside[UNCHANGED]} "
        f"with the same head, {outside[CHANGED]} after a head change.",
        "",
        "An ejection's head is the PR head when the ejected pass was queued (the last "
        "add before the removal), taken from the PR's push log — the runs of "
        f"`{report['anchors']['prPushes']}`, one per push. It is a false ejection when "
        "the PR later merged with exactly that head. The removal's `beforeCommit` cannot "
        "say: it is the merge-group commit, different on every pass.",
    ]
    if ejections["details"]:
        lines += [
            "",
            "<details><summary>Ejections</summary>",
            "",
            "| PR | reason | removed (UTC) | ejected head | merged head | outcome |",
            "|---|---|---|---|---|---|",
        ]
        lines += [
            f"| #{d['pr']} | `{d['reason']}` | {human(d['removedAt'])} | {short(d['ejectedHead'])} "
            f"| {short(d['finalHead'])} | {d['outcome']} |"
            for d in ejections["details"]
        ]
        lines += ["", "</details>"]

    def cost_row(label: str, key: str, unit: str = "", digits: int = 1, mean: bool = False) -> str:
        cells = []
        for cost in (pr_cost, mg_cost):
            sample = cost[key]
            values = [sample["p50"], sample["p90"]] + ([sample["mean"]] if mean else [])
            cells.append(f"{_values(values, unit, digits)} (n={sample['n']})")
        return f"| {label} | {cells[0]} | {cells[1]} |"

    pr_counts = pr_cost.get("populationCounts") or {}
    lines += [
        "",
        "### CI cost per commit — sample",
        "",
        "| | PR heads | merge groups |",
        "|---|---|---|",
        f"| population in the window | {pr_cost['population']} heads of non-draft PRs to "
        f"`{report['branch']}` | {mg_cost['population']} merge-group commits |",
        f"| sampled: every k-th by push time | {pr_cost['sampled']} (k={fmt(pr_cost['every'], digits=2)}) "
        f"| {mg_cost['sampled']} (k={fmt(mg_cost['every'], digits=2)}) |",
        f"| measured (all runs finished) | {pr_cost['measured']} | {mg_cost['measured']} |",
        cost_row("workflow runs per commit, p50 / p90", "runsPerCommit"),
        cost_row("run attempts per commit, p50 / p90 / mean", "attemptsPerCommit", mean=True),
        cost_row("job-minutes per commit, p50 / p90 / mean", "jobMinutesPerCommit", " min", mean=True),
        f"| job-minutes, whole sample | {fmt(pr_cost['jobMinutesTotal'], ' min')} "
        f"| {fmt(mg_cost['jobMinutesTotal'], ' min')} |",
        cost_row("wall-clock, p50 / p90 (all attempts)", "wallClockMinutes", " min"),
        cost_row("wall-clock, p50 / p90 (first attempts)", "firstAttemptWallClockMinutes", " min"),
        cost_row("runner queue per job, p50 / p90 (n = jobs)", "runnerQueueSeconds", " s", 0),
        f"| runner queue per job, max | {fmt(pr_cost['runnerQueueSeconds']['max'], ' s', 0)} "
        f"| {fmt(mg_cost['runnerQueueSeconds']['max'], ' s', 0)} |",
        "",
        "PR heads count their `pull_request` and `pull_request_target` runs, merge groups "
        "their `merge_group` runs; other runs on the same commit (post-merge `push`, "
        "`workflow_run` follow-ups) are left out. Job-minutes are every attempt of every "
        "job that reached a runner; wall-clock runs from the commit's first run created to "
        f"its last job finished. PR heads come from the {pr_counts.get('anchorRuns', 0)} "
        f"`{report['anchors']['prPushes']}` runs in the window, one per push "
        f"({pr_counts.get('otherBase', 0)} of them for PRs to other branches; "
        f"{pr_counts.get('draft', 0)} heads left out as draft for as long as they were the "
        f"head); merge groups from the `{report['anchors']['mergeGroups']}` merge_group runs.",
    ]
    for title, cost in (("PR heads", pr_cost), ("Merge groups", mg_cost)):
        if not cost["commits"]:
            continue
        lines += [
            "",
            f"<details><summary>{title} sampled</summary>",
            "",
            "| commit | PR | pushed (UTC) | runs | attempts | job-min | wall-clock | first-attempt wall-clock |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for c in cost["commits"]:
            if "error" in c:
                lines.append(f"| {short(c['sha'])} | #{c['pr']} | {human(c['pushedAt'])} | unreadable | | | | |")
                continue
            lines.append(
                f"| {short(c['sha'])} | #{c['pr']} | {human(c['pushedAt'])} | {c['runs']} | {c['attempts']} "
                f"| {fmt(c['jobMinutes'])} | {fmt(c['wallClockMinutes'], ' min')} "
                f"| {fmt(c['firstAttemptWallClockMinutes'], ' min')}"
                + ("" if c["complete"] else " (still running)")
                + " |"
            )
        lines += ["", "</details>"]

    share = waste["shareOfSampleJobMinutes"]
    lines += [
        "",
        f"### Static-check waste — the {waste['measured']} measured PR heads of the sample",
        "",
        f"**{waste['withStaticFailure']} of {waste['measured']}** sampled PR heads ended with a "
        f"failing java/ui/py checkstyle. Test workflows still spent **{fmt(waste['testJobMinutes'], ' job-minutes')}** "
        f"on them ({fmt(share * 100 if share is not None else None, '%')} of the sample's job-minutes) — work a "
        "static gate would not have started. A head counts when the newest checkstyle job "
        "that ran on it failed; test workflows are those matching "
        f"`{TEST_WORKFLOW.pattern}`, checkstyle workflows excluded.",
    ]
    if waste["commits"]:
        lines += ["", "| commit | PR | failed check | test job-minutes | largest workflow |", "|---|---|---|---|---|"]
        for hit in waste["commits"]:
            top = next(iter(hit["byWorkflow"].items()), None)
            lines.append(
                f"| {short(hit['sha'])} | #{hit['pr']} | {', '.join(hit['failedChecks'])} "
                f"| {fmt(hit['testJobMinutes'])} | {f'`{top[0]}` {fmt(top[1])}' if top else '—'} |"
            )
    lines += _tail(report)
    return "\n".join(lines) + "\n"


def render_compare(report: dict[str, Any]) -> str:
    lines = [
        f"## CI shadow comparison — old workflows vs `{report['newWorkflow']}` — "
        f"`{report['repository']}`",
        "",
        _window_line(report),
        "",
        f"`{report['newWorkflow']}` ran {report['newWorkflowRuns']} times in the window "
        f"({report['newWorkflowRunsOtherEvents']} on events other than PRs and merge groups); "
        f"{report['population']} PR-head and merge-group commits, {report['sampled']} sampled "
        f"(every k-th by first run, k={fmt(report['every'], digits=2)}); **{report['overlap']}** "
        "of those also ran the old workflows on the same event and are compared. "
        f"{report['notSampled']} more ran both, but `{report['newWorkflow']}` left them out of "
        f'its shadow sample (`{PLAN_JOB}` ran "{NOT_SAMPLED_STEP}") and tested nothing, so '
        "they are excluded rather than scored as passes.",
        "",
        "Old verdict: the newest attempt of every required check is green (success, "
        "neutral or skipped): " + ", ".join(f"`{name}`" for name in report["oldRequiredChecks"])
        + f". Old workflows: {', '.join(f'`{name}`' for name in report['oldWorkflows'])}.",
    ]
    if not report["overlap"]:
        lines += ["", "**No overlap** — there is nothing to compare in this window yet."]
        return "\n".join(lines + _tail(report)) + "\n"

    ci, gate = report["agreement"]["ciRun"], report["agreement"]["shadowGate"]
    rows = [
        ("agree", "agree"),
        ("old pass, new pass", "oldPassNewPass"),
        ("old fail, new fail", "oldFailNewFail"),
        ("old pass, new fail", "oldPassNewFail"),
        ("old fail, new pass", "oldFailNewPass"),
    ]
    lines += [
        "",
        f"| verdict, over the {report['overlap']} overlapping commits | `{report['newWorkflow']}` run "
        f"| `{report['shadowContext']}` status |",
        "|---|---|---|",
        f"| decided by both sides | {ci['decided']} | {gate['decided']} |",
    ]
    lines += [f"| {label} | {ci[key]} | {gate[key]} |" for label, key in rows]
    lines += [
        f"| agreement rate | {fmt(ci['rate'], digits=3)} | {fmt(gate['rate'], digits=3)} |",
        f"| undecided (pending, cancelled, absent) | {sum(ci['undecided'].values())} "
        f"| {sum(gate['undecided'].values())} |",
    ]
    for event, group in report["agreement"]["byEvent"].items():
        lines.append(
            f"| … {event}: agree / decided | {group['ciRun']['agree']} / {group['ciRun']['decided']} "
            f"| {group['shadowGate']['agree']} / {group['shadowGate']['decided']} |"
        )
    cost = report["cost"]
    lines += [
        "",
        f"| cost per commit (n={cost['commits']}, both sides finished) | old | new |",
        "|---|---|---|",
        f"| job-minutes, p50 / p90 | {_p50_p90(cost['old']['jobMinutes'], ' min')} "
        f"| {_p50_p90(cost['new']['jobMinutes'], ' min')} |",
        f"| job-minutes, total | {fmt(cost['old']['jobMinutesTotal'], ' min')} "
        f"| {fmt(cost['new']['jobMinutesTotal'], ' min')} |",
        f"| wall-clock, p50 / p90 | {_p50_p90(cost['old']['wallClockMinutes'], ' min')} "
        f"| {_p50_p90(cost['new']['wallClockMinutes'], ' min')} |",
        "",
        "<details><summary>Per commit</summary>",
        "",
        "| commit | event | PR | old | new run | gate | old job-min | new job-min | old wall | new wall |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for pair in report["commits"]:
        if not pair.get("overlap"):
            continue
        old, new = pair["old"], pair["new"]
        reasons = ", ".join(old["failed"] + [f"{name} missing" for name in old["missing"]])
        lines.append(
            f"| {short(pair['sha'])} | {pair['event']} | #{pair['pr']} | {old['verdict']}"
            + (f" ({reasons})" if reasons else "")
            + f" | {new['verdict']} | {pair['gate']['verdict']} | {fmt(old['jobMinutes'])} "
            f"| {fmt(new['jobMinutes'])} | {fmt(old['wallClockMinutes'])} | {fmt(new['wallClockMinutes'])} |"
        )
    lines += ["", "</details>"]
    return "\n".join(lines + _tail(report)) + "\n"


# --------------------------------------------------------------------------- cli


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--owner", default="open-metadata")
    common.add_argument("--repo", default="OpenMetadata")
    common.add_argument("--branch", default="main")
    common.add_argument("--since", required=True, help="UTC date (YYYY-MM-DD) or ISO time")
    common.add_argument("--until", required=True, help="UTC date, inclusive, or ISO time")
    common.add_argument("--out", type=Path, required=True, help="Directory for metrics.json/.md")
    common.add_argument(
        "--sample-shas",
        type=int,
        default=DEFAULT_SAMPLE,
        help=f"Commits sampled per population (0-{MAX_SAMPLE})",
    )
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    base = commands.add_parser("baseline", parents=[common], help="Measure the current CI")
    base.add_argument("--push-anchor", default=PUSH_ANCHOR, help="Workflow run once per PR push")
    base.add_argument(
        "--merge-group-anchor", default=MERGE_GROUP_ANCHOR, help="Workflow run once per merge group"
    )
    comp = commands.add_parser("compare", parents=[common], help="Compare old CI with ci.yml")
    comp.add_argument("--old-workflows", required=True, help="Comma-separated workflow file names")
    comp.add_argument("--new-workflow", default="ci.yml")
    comp.add_argument(
        "--old-required-checks",
        default=",".join(OLD_REQUIRED_CHECKS),
        help="Comma-separated check names whose newest attempts make the old verdict",
    )
    comp.add_argument("--shadow-context", default=SHADOW_CONTEXT)
    args = parser.parse_args(argv)
    if not 0 <= args.sample_shas <= MAX_SAMPLE:
        parser.error(f"--sample-shas must be between 0 and {MAX_SAMPLE}")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    token = mq.env_token()
    now = mq.utcnow()
    try:
        since, until = measurement_window(args.since, args.until, now)
    except ValueError as exc:
        print(f"::error::{exc}")
        return 1
    measure, render = (
        (baseline, render_baseline) if args.command == "baseline" else (compare, render_compare)
    )
    calls = ApiCalls()
    try:
        with calls.counting():
            report = measure(args, since, until, now, token)
    except RuntimeError as exc:  # mq.ApiError, and GraphQL errors raised as RuntimeError
        print(f"::error::could not measure: {exc}")
        return 1
    report["apiCalls"] = {"rest": calls.rest, "graphql": calls.graphql}
    markdown = render(report)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "metrics.json").write_text(json.dumps(report, indent=1, default=str) + "\n", encoding="utf-8")
    (args.out / "metrics.md").write_text(markdown, encoding="utf-8")
    print(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
