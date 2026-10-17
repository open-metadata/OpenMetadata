"""ci_metrics: queue counts, false ejections, sampled CI cost, static-check waste and
the shadow comparison, measured over GitHub payloads served from memory."""

import argparse
import importlib.util
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mq = load_script("merge_queue_metrics")
cm = load_script("ci_metrics")

OWNER, REPO = "open-metadata", "OpenMetadata"
FULL = f"{OWNER}/{REPO}"
BASE = "8f06d46bd22acd4a8c6b500ac5c3c8a7d9c76c77"
DAY = datetime(2026, 10, 11, tzinfo=timezone.utc)
END_OF_DAY = datetime(2026, 10, 11, 23, 59, 59, 999999, tzinfo=timezone.utc)
NOW = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)


def t(clock, day=11):
    return f"2026-10-{day:02d}T{clock}Z"


def sha(tag):
    return (tag * 40)[:40]


def pr_node(
    number,
    *,
    created,
    branch,
    head,
    merged_at=None,
    head_repo=FULL,
    adds=(),
    removals=(),
    drafts=(),
    is_draft=False,
):
    """A PullRequest node as PR_HISTORY_QUERY returns it."""
    return {
        "number": number,
        "url": f"https://github.com/{FULL}/pull/{number}",
        "merged": merged_at is not None,
        "mergedAt": merged_at,
        "createdAt": created,
        "closedAt": merged_at,
        "isDraft": is_draft,
        "headRefName": branch,
        "headRefOid": head,
        "headRepository": {"nameWithOwner": head_repo} if head_repo else None,
        "adds": {"nodes": [{"createdAt": when} for when in adds]},
        "removals": {
            "nodes": [
                {"createdAt": when, "reason": reason, "beforeCommit": {"oid": oid} if oid else None}
                for when, reason, oid in removals
            ]
        },
        "drafts": {"nodes": [{"__typename": kind, "createdAt": when} for kind, when in drafts]},
    }


def workflow_run(
    run_id, head, workflow, event, created, *, conclusion="success", attempt=1, branch="feature", head_repo=FULL
):
    return {
        "id": run_id,
        "name": workflow.removesuffix(".yml"),
        "path": f".github/workflows/{workflow}",
        "event": event,
        "head_sha": head,
        "head_branch": branch,
        "head_repository": {"full_name": head_repo},
        "status": "completed",
        "conclusion": conclusion,
        "run_attempt": attempt,
        "created_at": created,
        "updated_at": created,
        "pull_requests": [],
    }


def job(
    job_id, run_id, name, created, started, completed, conclusion="success", attempt=1, runner=True, steps=()
):
    """runner: True for a runner of its own, a name to share one, False for none.
    steps: (name, conclusion) pairs."""
    if runner is True:
        runner = f"GitHub Actions {job_id}"
    return {
        "id": job_id,
        "run_id": run_id,
        "name": name,
        "run_attempt": attempt,
        "status": "completed",
        "conclusion": conclusion,
        "created_at": created,
        "started_at": started,
        "completed_at": completed,
        "runner_name": runner or None,
        "labels": ["ubuntu-latest"],
        "steps": [
            {"name": step, "status": "completed", "conclusion": outcome, "number": number}
            for number, (step, outcome) in enumerate(steps, 1)
        ],
    }


def plan_job(job_id, run_id, created, *, sampled):
    """ci.yml's `plan` job; its "Not sampled" step runs only when the shadow sample
    left the commit out."""
    return job(
        job_id,
        run_id,
        cm.PLAN_JOB,
        created,
        created,
        created,
        steps=[
            ("Detect changed areas", "success"),
            ("Decide tier and shadow sampling", "success"),
            (cm.NOT_SAMPLED_STEP, "skipped" if sampled else "success"),
        ],
    )


class FakeGitHub:
    """GitHub's REST and GraphQL reads, served from memory. Only mq.rest and mq.graphql
    are replaced, so mq.paginated_items pages through these payloads for real."""

    def __init__(self):
        self.prs = []  # (updatedAt, PullRequest node)
        self.runs = []
        self.jobs = {}
        self.statuses = {}
        self.missing_workflows = set()
        self.requests = []
        self.searches = []

    def install(self, monkeypatch):
        monkeypatch.setattr(cm.mq, "rest", self.rest)
        monkeypatch.setattr(cm.mq, "graphql", self.graphql)
        return self

    def graphql(self, query, variables, token):
        self.searches.append(variables["q"])
        bounds = variables["q"].split("updated:")[1]
        if bounds.startswith(">="):
            low, high = mq.parse_ts(bounds[2:]), None
        else:
            low, high = (mq.parse_ts(bound) for bound in bounds.split(".."))
        nodes = [
            node
            for updated, node in self.prs
            if low <= mq.parse_ts(updated) and (high is None or mq.parse_ts(updated) <= high)
        ]
        return {
            "search": {
                "issueCount": len(nodes),
                "pageInfo": {"hasNextPage": False, "endCursor": None},
                "nodes": nodes,
            }
        }

    def rest(self, path, token):
        self.requests.append(path)
        parts = urlsplit(path)
        query = {key: values[0] for key, values in parse_qs(parts.query).items()}
        route = parts.path.removeprefix(f"/repos/{FULL}")
        if route.endswith("/statuses"):
            return self.statuses.get(route.split("/")[2], [])
        if route.startswith("/actions/workflows/"):
            workflow = route.split("/")[3]
            if workflow in self.missing_workflows:
                raise mq.ApiError(f"HTTP 404 Not Found for {path}", status=404)
            runs = [run for run in self.runs if run["path"].endswith(f"/{workflow}")]
            if "created" in query:
                low, high = (mq.parse_ts(bound) for bound in query["created"].split(".."))
                runs = [run for run in runs if low <= mq.parse_ts(run["created_at"]) <= high]
            for param, field in (("event", "event"), ("branch", "head_branch")):
                if param in query:
                    runs = [run for run in runs if run[field] == query[param]]
            newest_first = sorted(runs, key=lambda run: (run["created_at"], run["id"]), reverse=True)
            return self.page("workflow_runs", newest_first, query)
        if route == "/actions/runs":
            return self.page(
                "workflow_runs", [run for run in self.runs if run["head_sha"] == query["head_sha"]], query
            )
        if route.endswith("/jobs"):
            assert query.get("filter") == "all", "every attempt must be read"
            return self.page("jobs", self.jobs.get(int(route.split("/")[3]), []), query)
        raise AssertionError(f"unexpected request {path}")

    @staticmethod
    def page(key, items, query):
        size, number = int(query.get("per_page", 30)), int(query.get("page", 1))
        return {"total_count": len(items), key: items[(number - 1) * size : number * size]}

    def jobs_read(self):
        return {
            int(urlsplit(path).path.split("/")[-2])
            for path in self.requests
            if urlsplit(path).path.endswith("/jobs")
        }

    def push_logs_read(self):
        return sorted(
            parse_qs(urlsplit(path).query)["branch"][0]
            for path in self.requests
            if "/workflows/team-labeler.yml/runs" in path and "branch=" in path
        )


def baseline_args(**overrides):
    values = {
        "owner": OWNER,
        "repo": REPO,
        "branch": "main",
        "sample_shas": 0,
        "push_anchor": cm.PUSH_ANCHOR,
        "merge_group_anchor": cm.MERGE_GROUP_ANCHOR,
    }
    return argparse.Namespace(**{**values, **overrides})


def compare_args(**overrides):
    values = {
        "owner": OWNER,
        "repo": REPO,
        "branch": "main",
        "sample_shas": 30,
        "old_workflows": "java-checkstyle.yml,playwright-postgresql-e2e.yml,py-tests.yml",
        "new_workflow": "ci.yml",
        "old_required_checks": "java-checkstyle,playwright-summary,py-tests-status",
        "shadow_context": cm.SHADOW_CONTEXT,
    }
    return argparse.Namespace(**{**values, **overrides})


# ------------------------------------------------------------------ merge queue


def test_queue_counts_split_latency_by_failed_checks_history():
    common = {"created": t("07:00:00"), "branch": "b", "head": sha("01")}
    prs = [
        pr_node(
            1,
            **common,
            merged_at=t("13:00:00"),
            adds=[t("08:00:00"), t("10:00:00"), t("12:00:00")],
            removals=[
                (t("09:00:00"), "failed_checks", sha("e1")),
                (t("11:00:00"), "failed_checks", sha("e2")),
                (t("13:00:00"), "merged", sha("e3")),
            ],
        ),
        pr_node(
            2,
            **common,
            merged_at=t("11:30:00"),
            adds=[t("08:30:00"), t("10:30:00")],
            removals=[(t("09:30:00"), "failed_checks", sha("e4")), (t("11:30:00"), "merged", sha("e5"))],
        ),
        pr_node(3, **common, merged_at=t("11:00:00"), adds=[t("10:00:00")], removals=[(t("11:00:00"), "merged", sha("e6"))]),
        pr_node(4, **common, merged_at=t("11:00:00"), adds=[t("09:00:00")], removals=[(t("11:00:00"), "merged", sha("e7"))]),
        pr_node(5, **common, merged_at=t("12:00:00")),  # merged without the queue
        pr_node(6, **common, adds=[t("09:00:00")], removals=[(t("09:45:00"), "merge_conflict", None)]),
        # Ejected the day before the window, merged inside it: its latency includes that pass.
        pr_node(
            7,
            created=t("19:00:00", 10),
            branch="c",
            head=sha("02"),
            merged_at=t("10:00:00"),
            adds=[t("20:00:00", 10), t("09:00:00")],
            removals=[(t("21:00:00", 10), "failed_checks", sha("e8")), (t("10:00:00"), "merged", sha("e9"))],
        ),
        # Ejected, then merged by hand outside the queue: realized_metrics still counts
        # it as merged via the queue, because it was queued.
        pr_node(
            8,
            **common,
            merged_at=t("12:00:00"),
            adds=[t("09:00:00")],
            removals=[(t("09:30:00"), "failed_checks", sha("ea"))],
        ),
    ]

    queue = cm.queue_section(prs, DAY, END_OF_DAY)

    assert queue["mergedViaQueue"] == 6
    assert queue["mergedViaQueueWithoutMergedRemoval"] == 1
    assert queue["mergedBypassingQueue"] == 1
    assert queue["enqueuesPerMergedPr"] == {"n": 6, "mean": 1.67, "median": 1.5}
    # Latencies 5h, 3h, 1h, 2h, 14h and 3h; nearest-rank percentiles as in the daily report.
    assert queue["enqueueToMergeHours"] == {
        "all": {"n": 6, "p50": 3.0, "p90": 14.0},
        "withFailedChecksRemoval": {"n": 4, "p50": 5.0, "p90": 14.0},
        "withoutFailedChecksRemoval": {"n": 2, "p50": 2.0, "p90": 2.0},
    }
    assert queue["dequeueReasons"] == {"merged": 5, "failed_checks": 4, "merge_conflict": 1}


# -------------------------------------------------------------- false ejections


def ejection_history(github):
    labeler = "team-labeler.yml"
    github.prs = [
        (t("20:00:00"), pr)
        for pr in (
            # Ejected twice with the same head, then merged with it: two false ejections,
            # although each removal names a different merge-group commit.
            pr_node(
                100,
                created=t("08:00:00", 10),
                branch="fix/flaky-settings",
                head=sha("a1"),
                merged_at=t("13:00:00"),
                adds=[t("08:00:00"), t("10:00:00"), t("12:00:00")],
                removals=[
                    (t("09:00:00"), "failed_checks", sha("e1")),
                    (t("11:00:00"), "failed_checks", sha("e2")),
                    (t("13:00:00"), "merged", sha("e3")),
                ],
            ),
            # Ejected, fixed by a push, merged.
            pr_node(
                101,
                created=t("10:00:00", 10),
                branch="feat/lineage",
                head=sha("b2"),
                merged_at=t("11:30:00"),
                adds=[t("08:30:00"), t("10:30:00")],
                removals=[(t("09:30:00"), "failed_checks", sha("e4")), (t("11:30:00"), "merged", sha("e5"))],
            ),
            # Conflicted out and still open.
            pr_node(
                102,
                created=t("11:00:00", 10),
                branch="feat/search",
                head=sha("c1"),
                adds=[t("09:00:00")],
                removals=[(t("09:45:00"), "merge_conflict", None)],
            ),
            # Ejected before the window: not counted.
            pr_node(
                103,
                created=t("08:00:00", 8),
                branch="fix/old",
                head=sha("c3"),
                merged_at=t("12:00:00", 9),
                adds=[t("08:00:00", 9), t("10:00:00", 9)],
                removals=[(t("09:00:00", 9), "failed_checks", sha("e6")), (t("12:00:00", 9), "merged", sha("e7"))],
            ),
            # The fork was deleted: its branch name alone cannot identify its pushes.
            pr_node(
                104,
                created=t("12:00:00", 10),
                branch="patch-1",
                head=sha("d1"),
                head_repo=None,
                merged_at=t("15:00:00"),
                adds=[t("13:00:00"), t("14:00:00")],
                removals=[(t("13:30:00"), "failed_checks", sha("e8")), (t("15:00:00"), "merged", sha("e9"))],
            ),
            # Ejected, then merged by hand outside the queue with the same head.
            pr_node(
                105,
                created=t("13:00:00", 10),
                branch="fix/ci-flake",
                head=sha("f5"),
                merged_at=t("18:00:00"),
                adds=[t("16:00:00")],
                removals=[(t("17:00:00"), "failed_checks", sha("ea"))],
            ),
        )
    ]
    github.runs += [
        workflow_run(5001, sha("a0"), labeler, "pull_request_target", t("08:00:20", 10), branch="fix/flaky-settings"),
        workflow_run(5002, sha("a1"), labeler, "pull_request_target", t("09:00:00", 10), branch="fix/flaky-settings"),
        # Another fork pushed a branch of the same name just before the first pass.
        workflow_run(
            5003,
            sha("f1"),
            labeler,
            "pull_request_target",
            t("07:00:00"),
            branch="fix/flaky-settings",
            head_repo="someone/OpenMetadata",
        ),
        workflow_run(5011, sha("b1"), labeler, "pull_request_target", t("10:00:15", 10), branch="feat/lineage"),
        workflow_run(5012, sha("b2"), labeler, "pull_request_target", t("10:00:00"), branch="feat/lineage"),
        workflow_run(5021, sha("f5"), labeler, "pull_request_target", t("13:00:10", 10), branch="fix/ci-flake"),
    ]


def test_an_ejection_is_false_when_the_same_head_later_merges(monkeypatch):
    github = FakeGitHub().install(monkeypatch)
    ejection_history(github)

    report = cm.baseline(baseline_args(), DAY, END_OF_DAY, NOW, "t")
    ejections = report["ejections"]

    assert ejections["total"] == 6
    assert ejections["outcomes"] == {cm.UNCHANGED: 3, cm.CHANGED: 1, cm.NEVER_MERGED: 1, cm.HEAD_UNKNOWN: 1}
    assert ejections["byReason"] == {
        "failed_checks": {cm.UNCHANGED: 3, cm.CHANGED: 1, cm.NEVER_MERGED: 0, cm.HEAD_UNKNOWN: 1},
        "merge_conflict": {cm.UNCHANGED: 0, cm.CHANGED: 0, cm.NEVER_MERGED: 1, cm.HEAD_UNKNOWN: 0},
    }
    assert ejections["mergedOutsideQueue"] == {cm.UNCHANGED: 1, cm.CHANGED: 0, cm.HEAD_UNKNOWN: 0}
    by_pr = {}
    for detail in ejections["details"]:
        by_pr.setdefault(detail["pr"], []).append(detail)
    assert [(d["ejectedHead"], d["finalHead"], d["requeued"]) for d in by_pr[100]] == [
        (sha("a1"), sha("a1"), True)
    ] * 2
    assert [(d["ejectedHead"], d["finalHead"], d["outcome"]) for d in by_pr[101]] == [
        (sha("b1"), sha("b2"), cm.CHANGED)
    ]
    assert [(d["outcome"], d["requeued"]) for d in by_pr[105]] == [(cm.UNCHANGED, False)]
    assert 103 not in by_pr
    # Only merged PRs with a live head repository need a push log.
    assert github.push_logs_read() == ["feat/lineage", "fix/ci-flake", "fix/flaky-settings"]


# ------------------------------------------------------------------ populations


def labeler_push(run_id, branch, head, created, head_repo=FULL):
    return workflow_run(run_id, head, "team-labeler.yml", "pull_request_target", created, branch=branch, head_repo=head_repo)


def test_pr_heads_come_from_ready_prs_to_the_branch_in_push_order():
    prs = [
        # Opened as draft, pushed again, then marked ready without a push: the ready
        # event runs the full CI on the second head, never on the first.
        pr_node(
            200,
            created=t("08:00:00"),
            branch="feat/draft-then-ready",
            head=sha("d2"),
            drafts=[("ReadyForReviewEvent", t("10:00:00"))],
        ),
        pr_node(201, created=t("08:30:00"), branch="feat/ready", head=sha("12")),
        pr_node(202, created=t("08:45:00"), branch="wip/draft", head=sha("33"), is_draft=True),
        # Converted to draft between its two pushes.
        pr_node(
            203,
            created=t("09:00:00"),
            branch="feat/converted",
            head=sha("e2"),
            is_draft=True,
            drafts=[("ConvertToDraftEvent", t("09:30:00"))],
        ),
    ]
    pushes = [
        labeler_push(1, "feat/draft-then-ready", sha("d1"), t("08:00:10")),
        labeler_push(2, "feat/draft-then-ready", sha("d2"), t("09:00:00")),
        labeler_push(3, "feat/ready", sha("11"), t("08:30:05")),
        labeler_push(4, "feat/ready", sha("12"), t("11:00:00")),
        labeler_push(5, "feat/ready", sha("12"), t("12:00:00")),  # reopened: same head
        labeler_push(6, "wip/draft", sha("33"), t("08:45:05")),
        labeler_push(7, "feat/converted", sha("e1"), t("09:00:05")),
        labeler_push(8, "feat/converted", sha("e2"), t("10:00:00")),
        labeler_push(9, "backport/1.13", sha("44"), t("09:10:00")),  # a PR to a release branch
        labeler_push(10, "feat/ready", sha("55"), t("09:30:00"), head_repo="contributor/OpenMetadata"),
    ]

    population, counts = cm.pr_head_population(pushes, prs, NOW)

    assert [(c["pr"], c["sha"]) for c in population] == [
        (201, sha("11")),
        (200, sha("d2")),
        (203, sha("e1")),
        (201, sha("12")),
    ]
    assert counts == {"anchorRuns": 10, "draft": 3, "eligible": 4, "otherBase": 2}
    shuffled = pushes[:]
    random.Random(7).shuffle(shuffled)
    assert cm.pr_head_population(shuffled, prs[::-1], NOW)[0] == population


def test_sampling_takes_every_kth_commit_in_push_order():
    population = [{"sha": sha(f"{i:02d}"), "pr": i, "pushedAt": t(f"0{i}:00:00")} for i in range(10)]
    assert [c["pr"] for c in cm.every_kth(population, 3)] == [0, 3, 6]
    assert cm.every_kth(population, 3) == cm.every_kth(list(population), 3)
    assert cm.every_kth(population, 30) == population
    assert cm.every_kth(population, 0) == []


def test_merge_groups_are_one_candidate_per_commit_on_the_branch():
    runs = [
        workflow_run(1, sha("a1"), "java-checkstyle.yml", "merge_group", t("09:00:00"), branch=f"gh-readonly-queue/main/pr-1-{BASE}"),
        workflow_run(2, sha("a1"), "java-checkstyle.yml", "merge_group", t("09:40:00"), attempt=2, branch=f"gh-readonly-queue/main/pr-1-{BASE}"),
        workflow_run(3, sha("a2"), "java-checkstyle.yml", "merge_group", t("08:00:00"), branch=f"gh-readonly-queue/release/1.13/pr-2-{BASE}"),
        workflow_run(4, sha("a3"), "java-checkstyle.yml", "push", t("08:30:00"), branch="main"),
    ]
    assert cm.merge_group_population(runs, "main") == [{"sha": sha("a1"), "pr": 1, "pushedAt": t("09:00:00")}]


# ------------------------------------------------------------------- CI cost


def static_failure_history(github):
    """A PR head whose java-checkstyle failed while its Python tests ran twice, and one
    whose ui-checkstyle failed once and passed on a re-run."""
    target = "pull_request_target"
    red, green = sha("c1"), sha("c2")
    github.runs += [
        workflow_run(1001, red, "java-checkstyle.yml", target, t("10:00:00"), conclusion="failure"),
        workflow_run(1002, red, "py-tests.yml", target, t("10:00:00"), attempt=2),
        workflow_run(1003, red, "integration-tests-mysql-elasticsearch.yml", "pull_request", t("10:00:00"), conclusion="skipped"),
        workflow_run(1004, red, "team-labeler.yml", target, t("10:00:00")),
        workflow_run(1005, red, "playwright-postgresql-pr-comment.yml", "workflow_run", t("10:40:00")),
        workflow_run(1101, green, "ui-checkstyle.yml", target, t("12:00:00"), attempt=2),
        workflow_run(1102, green, "yarn-coverage.yml", target, t("12:00:00")),
    ]
    github.jobs.update(
        {
            1001: [job(1, 1001, "java-checkstyle", t("10:00:00"), t("10:00:30"), t("10:05:30"), "failure")],
            1002: [
                job(2001, 1002, "py-run-tests (3.10)", t("10:00:00"), t("10:02:00"), t("10:32:00"), "failure"),
                job(2002, 1002, "py-run-tests (3.10)", t("11:00:00"), t("11:01:00"), t("11:21:00"), attempt=2),
                job(2004, 1002, "py-build", t("10:00:00"), t("10:00:40"), t("10:10:40")),
                # "Re-run failed jobs" lists the job it did not re-run again under attempt
                # 2, with the original runner and timestamps: one execution, not two.
                job(2005, 1002, "py-build", t("10:00:00"), t("10:00:40"), t("10:10:40"), attempt=2, runner="GitHub Actions 2004"),
                # Skipped: no runner, and completed_at before started_at.
                job(2003, 1002, "py-tests-status", t("10:00:10"), t("10:00:10"), t("10:00:00"), "skipped", runner=False),
            ],
            1004: [job(4001, 1004, "Team Label", t("10:00:00"), t("10:00:05"), t("10:00:35"))],
            1101: [
                job(3001, 1101, "ui-checkstyle", t("12:00:00"), t("12:00:20"), t("12:10:20"), "failure"),
                job(3002, 1101, "ui-checkstyle", t("12:30:00"), t("12:30:10"), t("12:40:10"), attempt=2),
            ],
            1102: [job(3101, 1102, "ui-coverage", t("12:00:00"), t("12:01:00"), t("12:21:00"))],
        }
    )
    return [
        {"sha": red, "pr": 300, "pushedAt": t("10:00:00")},
        {"sha": green, "pr": 301, "pushedAt": t("12:00:00")},
    ]


def test_commit_cost_counts_every_attempt_that_reached_a_runner(monkeypatch):
    github = FakeGitHub().install(monkeypatch)
    red, _ = static_failure_history(github)

    record, queue = cm.measure_commit(OWNER, REPO, red, cm.PR_EVENTS, "t")

    assert record["runs"] == 4
    assert record["attempts"] == 5
    assert record["jobsRun"] == 5
    # 5 (checkstyle) + 30 + 20 (two attempts of the tests) + 10 (py-build, once) + 0.5.
    assert record["jobMinutes"] == 65.5
    assert record["jobMinutesByWorkflow"] == {
        "py-tests.yml": 60.0,
        "java-checkstyle.yml": 5.0,
        "team-labeler.yml": 0.5,
    }
    assert record["wallClockMinutes"] == 81.0
    assert record["firstAttemptWallClockMinutes"] == 32.0
    assert sorted(queue) == [5.0, 30.0, 40.0, 60.0, 120.0]
    assert record["runnerQueueSeconds"] == {"p50": 40.0, "p90": 120.0, "max": 120.0}
    assert record["staticFailures"] == ["java-checkstyle"]
    assert record["otherEventRuns"] == {"workflow_run": 1}
    assert record["complete"] is True
    # Neither the skipped run nor the follow-up run of another event was listed.
    assert github.jobs_read() == {1001, 1002, 1004}


def test_static_waste_is_the_test_minutes_on_heads_whose_checkstyle_ended_red(monkeypatch):
    github = FakeGitHub().install(monkeypatch)
    candidates = static_failure_history(github)
    measured = [cm.measure_commit(OWNER, REPO, c, cm.PR_EVENTS, "t") for c in candidates]

    waste = cm.static_waste([record for record, _ in measured])
    cost = cm.cost_section(len(candidates), measured)

    assert waste["measured"] == 2
    assert waste["withStaticFailure"] == 1
    # py-tests on the red head only: labelling is not a test, checkstyle is the gate
    # itself, and a checkstyle that went green on a re-run blocks nothing.
    assert waste["commits"] == [
        {
            "sha": sha("c1"),
            "pr": 300,
            "failedChecks": ["java-checkstyle"],
            "testJobMinutes": 60.0,
            "byWorkflow": {"py-tests.yml": 60.0},
        }
    ]
    assert waste["shareOfSampleJobMinutes"] == round(60.0 / 105.5, 3)
    assert cost["jobMinutesTotal"] == 105.5
    # Queue seconds 5, 30, 40, 60, 120 on the red head and 20, 10, 60 on the green one.
    assert cost["runnerQueueSeconds"] == {"n": 8, "p50": 40.0, "p90": 120.0, "max": 120.0, "mean": 43.0}


# ---------------------------------------------------------------------- compare


def merge_group(github, head, pr, base_id, *, summary="success", ci="success", with_py_tests=True):
    branch = f"gh-readonly-queue/main/pr-{pr}-{BASE}"
    java, playwright, py, ci_run = base_id + 1, base_id + 2, base_id + 3, base_id + 5
    github.runs += [
        workflow_run(java, head, "java-checkstyle.yml", "merge_group", t("08:00:00"), branch=branch),
        workflow_run(playwright, head, "playwright-postgresql-e2e.yml", "merge_group", t("08:00:00"), branch=branch, conclusion=summary),
        workflow_run(ci_run, head, "ci.yml", "merge_group", t("08:00:00"), branch=branch, conclusion=ci),
    ]
    github.jobs[java] = [job(java * 10, java, "java-checkstyle", t("08:00:00"), t("08:00:10"), t("08:05:10"))]
    github.jobs[playwright] = [
        job(
            playwright * 10,
            playwright,
            "playwright / playwright-ci (chromium-01, chromium-01.json, 3, chromium, false)",
            t("08:00:00"),
            t("08:00:20"),
            t("08:20:20"),
        ),
        job(playwright * 10 + 1, playwright, "playwright-summary", t("08:20:20"), t("08:20:30"), t("08:21:30"), summary),
    ]
    github.jobs[ci_run] = [
        plan_job(ci_run * 10 + 1, ci_run, t("08:00:00"), sampled=True),
        job(ci_run * 10, ci_run, "static / java", t("08:00:00"), t("08:00:05"), t("08:15:05"), ci),
    ]
    if with_py_tests:
        github.runs.append(workflow_run(py, head, "py-tests.yml", "merge_group", t("08:00:00"), branch=branch))
        github.jobs[py] = [job(py * 10, py, "py-tests-status", t("08:00:00"), t("08:00:05"), t("08:01:05"))]


def shadow_period(github):
    green, flaky, missing, cancelled, new_only, unsampled, head = (
        sha(tag) for tag in ("a1", "a2", "a3", "a4", "a5", "a6", "b1")
    )
    gate = cm.SHADOW_CONTEXT
    merge_group(github, green, 401, 6100)
    # After the merge the same commit is main's head and collects `push` runs.
    github.runs.append(workflow_run(6104, green, "java-checkstyle.yml", "push", t("09:00:00"), branch="main", conclusion="failure"))
    github.jobs[6104] = [job(61040, 6104, "java-checkstyle", t("09:00:00"), t("09:00:05"), t("09:04:05"), "failure")]
    merge_group(github, flaky, 402, 6200, summary="failure", ci="failure")
    merge_group(github, missing, 403, 6300, with_py_tests=False)

    branch = f"gh-readonly-queue/main/pr-404-{BASE}"
    github.runs += [
        workflow_run(6401, cancelled, "java-checkstyle.yml", "merge_group", t("08:00:00"), branch=branch, conclusion="cancelled"),
        workflow_run(6402, cancelled, "playwright-postgresql-e2e.yml", "merge_group", t("08:00:00"), branch=branch, conclusion="cancelled"),
        workflow_run(6405, cancelled, "ci.yml", "merge_group", t("08:00:00"), branch=branch, conclusion="cancelled"),
        workflow_run(6505, new_only, "ci.yml", "merge_group", t("08:00:00"), branch=f"gh-readonly-queue/main/pr-405-{BASE}"),
        # Both ran, but ci.yml's shadow sample left the commit out: it tested nothing
        # and still concluded success.
        workflow_run(6701, unsampled, "java-checkstyle.yml", "merge_group", t("08:00:00"), branch=f"gh-readonly-queue/main/pr-407-{BASE}"),
        workflow_run(6705, unsampled, "ci.yml", "merge_group", t("08:00:00"), branch=f"gh-readonly-queue/main/pr-407-{BASE}"),
        workflow_run(6601, head, "java-checkstyle.yml", "pull_request_target", t("07:00:00"), branch="feat/p1"),
        workflow_run(6602, head, "playwright-postgresql-e2e.yml", "pull_request", t("07:00:00"), branch="feat/p1", conclusion="skipped"),
        workflow_run(6603, head, "py-tests.yml", "pull_request_target", t("07:00:00"), branch="feat/p1", conclusion="skipped"),
        workflow_run(6605, head, "ci.yml", "pull_request", t("07:00:00"), branch="feat/p1"),
    ]
    github.jobs.update(
        {
            6401: [job(64010, 6401, "java-checkstyle", t("08:00:00"), t("08:00:10"), t("08:02:10"), "cancelled")],
            6402: [],
            6405: [job(64050, 6405, "static / java", t("08:00:00"), t("08:00:05"), t("08:03:05"), "cancelled")],
            6701: [job(67010, 6701, "java-checkstyle", t("08:00:00"), t("08:00:10"), t("08:05:10"))],
            6705: [
                plan_job(67051, 6705, t("08:00:00"), sampled=False),
                job(67050, 6705, "static / java", t("08:00:05"), t("08:00:05"), t("08:00:04"), "skipped", runner=False),
            ],
            6601: [job(66010, 6601, "java-checkstyle", t("07:00:00"), t("07:00:10"), t("07:05:10"))],
            6602: [job(66020, 6602, "playwright-summary", t("07:00:00"), t("07:00:00"), t("06:59:50"), "skipped", runner=False)],
            6603: [job(66030, 6603, "py-tests-status", t("07:00:00"), t("07:00:00"), t("06:59:55"), "skipped", runner=False)],
            6605: [job(66050, 6605, "static / java", t("07:00:00"), t("07:00:05"), t("07:10:05"))],
        }
    )
    github.statuses = {
        green: [{"context": gate, "state": "success"}, {"context": gate, "state": "pending"}],
        # The gate forgave a failure it could not reproduce.
        flaky: [{"context": gate, "state": "success"}],
        missing: [{"context": gate, "state": "success"}],
        head: [{"context": "other", "state": "failure"}, {"context": gate, "state": "success"}],
    }
    return green, flaky, missing, cancelled, new_only, unsampled, head


def test_compare_scores_both_new_verdicts_against_the_old_required_checks(monkeypatch):
    github = FakeGitHub().install(monkeypatch)
    green, flaky, missing, cancelled, new_only, unsampled, head = shadow_period(github)

    report = cm.compare(compare_args(), DAY, END_OF_DAY, NOW, "t")

    assert (report["population"], report["sampled"], report["overlap"], report["notSampled"]) == (7, 7, 5, 1)
    assert report["agreement"]["ciRun"] == {
        "decided": 4,
        "agree": 3,
        "rate": 0.75,
        "oldPassNewPass": 2,
        "oldPassNewFail": 0,
        "oldFailNewPass": 1,
        "oldFailNewFail": 1,
        "undecided": {"cancelled/cancelled": 1},
    }
    assert report["agreement"]["shadowGate"] == {
        "decided": 4,
        "agree": 2,
        "rate": 0.5,
        "oldPassNewPass": 2,
        "oldPassNewFail": 0,
        "oldFailNewPass": 2,
        "oldFailNewFail": 0,
        "undecided": {"cancelled/absent": 1},
    }
    by_event = report["agreement"]["byEvent"]
    assert (by_event["merge_group"]["shadowGate"]["agree"], by_event["merge_group"]["shadowGate"]["decided"]) == (1, 3)
    assert (by_event["pr"]["ciRun"]["agree"], by_event["pr"]["ciRun"]["decided"]) == (1, 1)

    commits = {pair["sha"]: pair for pair in report["commits"]}
    assert commits[green]["old"]["verdict"] == cm.PASS  # its post-merge push failure is not queue CI
    assert commits[flaky]["old"]["failed"] == ["playwright-summary"]
    assert commits[missing]["old"]["missing"] == ["py-tests-status"]
    assert commits[cancelled]["old"]["verdict"] == cm.CANCELLED
    assert commits[new_only]["overlap"] is False
    # Left out, not scored: its ci.yml run concluded success without testing anything.
    assert (commits[unsampled]["overlap"], commits[unsampled]["notSampled"]) == (False, True)
    assert commits[head]["old"]["verdict"] == cm.PASS  # skipped required checks pass
    assert (commits[green]["old"]["jobMinutes"], commits[green]["new"]["jobMinutes"]) == (27.0, 15.0)
    assert report["cost"]["commits"] == 5
    assert report["cost"]["old"]["jobMinutesTotal"] == 87.0
    assert report["cost"]["new"]["jobMinutesTotal"] == 58.0

    read = github.jobs_read()
    assert 6104 not in read and 6505 not in read
    assert {6602, 6603} <= read  # a skipped run carries the skipped required check
    # An unsampled commit costs one jobs listing: no old jobs, no statuses.
    assert 6705 in read and 6701 not in read
    assert not [path for path in github.requests if f"/commits/{unsampled}/statuses" in path]


def test_compare_before_ci_yml_exists_reports_zero_overlap(monkeypatch, tmp_path):
    github = FakeGitHub().install(monkeypatch)
    github.missing_workflows.add("ci.yml")
    monkeypatch.setenv("GH_TOKEN", "t")
    monkeypatch.setattr(cm.mq, "utcnow", lambda: NOW)

    code = cm.main(
        [
            "compare",
            "--since", "2026-10-11",
            "--until", "2026-10-11",
            "--old-workflows", "java-checkstyle.yml,py-tests.yml",
            "--out", str(tmp_path),
        ]
    )

    assert code == 0
    report = json.loads((tmp_path / "metrics.json").read_text())
    assert (report["population"], report["sampled"], report["overlap"]) == (0, 0, 0)
    assert report["agreement"]["ciRun"]["rate"] is None
    assert "HTTP 404" in report["warnings"][0]
    assert report["apiCalls"] == {"rest": 1, "graphql": 0}
    assert "No overlap" in (tmp_path / "metrics.md").read_text()


def test_an_unreadable_listing_fails_instead_of_reporting_zero(monkeypatch, tmp_path):
    def outage(path, token):
        raise mq.ApiError(f"HTTP 502 Bad Gateway for {path}", status=502)

    monkeypatch.setattr(cm.mq, "rest", outage)
    monkeypatch.setenv("GH_TOKEN", "t")
    monkeypatch.setattr(cm.mq, "utcnow", lambda: NOW)

    code = cm.main(
        ["compare", "--since", "2026-10-11", "--until", "2026-10-11", "--old-workflows", "a.yml", "--out", str(tmp_path)]
    )

    assert code == 1
    assert not (tmp_path / "metrics.json").exists()


# --------------------------------------------------------------------- plumbing


def test_pr_search_is_sliced_by_day_and_an_overflowing_slice_is_reported(monkeypatch):
    searches = []

    def graphql(query, variables, token):
        searches.append(variables["q"])
        overflowing = len(searches) == 2
        return {
            "search": {
                # Search stops at 1,000 matches whatever issueCount says.
                "issueCount": 1500 if overflowing else 1,
                "pageInfo": {"hasNextPage": False, "endCursor": None},
                "nodes": [pr_node(7, created=t("07:00:00"), branch="b", head=sha("01"))],
            }
        }

    monkeypatch.setattr(cm.mq, "graphql", graphql)
    prs, truncated = cm.fetch_pr_history(OWNER, REPO, "main", DAY, DAY + timedelta(days=2, hours=12), "t")

    assert searches == [
        f"repo:{FULL} is:pr base:main updated:2026-10-11T00:00:00Z..2026-10-12T00:00:00Z",
        f"repo:{FULL} is:pr base:main updated:2026-10-12T00:00:00Z..2026-10-13T00:00:00Z",
        f"repo:{FULL} is:pr base:main updated:>=2026-10-13T00:00:00Z",
    ]
    assert [pr["number"] for pr in prs] == [7]
    assert truncated is True


@pytest.mark.parametrize(
    "since, until, problem",
    [
        ("2026-10-11", "2026-10-10", "must be before"),
        ("2026-09-01", "2026-10-11", "over 31 days"),
        ("2026-07-01", "2026-07-02", "over 90 days ago"),
    ],
)
def test_windows_that_cannot_be_measured_are_refused(since, until, problem):
    with pytest.raises(ValueError, match=problem):
        cm.measurement_window(since, until, NOW)


def test_baseline_writes_both_reports_and_counts_its_api_calls(monkeypatch, tmp_path):
    github = FakeGitHub().install(monkeypatch)
    queue_branch = f"gh-readonly-queue/main/pr-500-{BASE}"
    head, group = sha("51"), sha("5a")
    github.prs = [
        (
            t("10:00:00"),
            pr_node(
                500,
                created=t("07:00:00"),
                branch="feat/e2e",
                head=head,
                merged_at=t("10:00:00"),
                adds=[t("09:00:00")],
                removals=[(t("10:00:00"), "merged", group)],
            ),
        )
    ]
    github.runs += [
        labeler_push(7001, "feat/e2e", head, t("07:00:05")),
        workflow_run(7002, head, "java-checkstyle.yml", "pull_request_target", t("07:00:05"), branch="feat/e2e"),
        workflow_run(7101, group, "java-checkstyle.yml", "merge_group", t("09:00:10"), branch=queue_branch),
        workflow_run(7102, group, "py-tests.yml", "merge_group", t("09:00:10"), branch=queue_branch),
        workflow_run(7103, group, "java-checkstyle.yml", "push", t("10:01:00"), branch="main"),
    ]
    github.jobs.update(
        {
            7001: [job(70010, 7001, "Team Label", t("07:00:05"), t("07:00:10"), t("07:00:40"))],
            7002: [job(70020, 7002, "java-checkstyle", t("07:00:05"), t("07:00:20"), t("07:02:20"))],
            7101: [job(71010, 7101, "java-checkstyle", t("09:00:10"), t("09:00:20"), t("09:03:20"))],
            7102: [job(71020, 7102, "py-tests-status", t("09:00:10"), t("09:00:30"), t("09:10:30"))],
        }
    )
    monkeypatch.setenv("GH_TOKEN", "t")
    monkeypatch.setattr(cm.mq, "utcnow", lambda: NOW)

    code = cm.main(
        ["baseline", "--since", "2026-10-11", "--until", "2026-10-11", "--sample-shas", "5", "--out", str(tmp_path)]
    )

    assert code == 0
    report = json.loads((tmp_path / "metrics.json").read_text())
    assert report["queue"]["mergedViaQueue"] == 1
    prs, groups = report["ciCost"]["prHeads"], report["ciCost"]["mergeGroups"]
    assert (prs["population"], prs["sampled"], prs["measured"], prs["jobMinutesTotal"]) == (1, 1, 1, 2.5)
    assert (groups["population"], groups["sampled"], groups["measured"], groups["jobMinutesTotal"]) == (1, 1, 1, 13.0)
    assert groups["commits"][0]["otherEventRuns"] == {"push": 1}
    # Two anchor listings, then per commit one runs listing and one jobs listing per run.
    assert report["apiCalls"] == {"rest": len(github.requests), "graphql": len(github.searches)}
    assert report["apiCalls"] == {"rest": 8, "graphql": 2}
    markdown = (tmp_path / "metrics.md").read_text()
    assert "Window **2026-10-11 00:00 → 2026-10-11 23:59 UTC**" in markdown
    assert "13.0 / 13.0 / 13.0 min (n=1)" in markdown
