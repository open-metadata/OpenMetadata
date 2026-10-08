"""Daily CI health report: listing, aggregation and rendering, all offline."""

import importlib.util
import io
import json
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


report = load_script("ci_health_report")

NOW = datetime(2026, 10, 8, 6, 0, tzinfo=timezone.utc)
QUEUE = ".github/workflows/playwright-postgresql-e2e.yml"


def ts(hours_ago):
    return report.iso(NOW - timedelta(hours=hours_ago))


def run(run_id, hours_ago=1, event="merge_group", conclusion="success", pr=1, path=QUEUE, name=None):
    return {
        "id": run_id,
        "html_url": f"https://github.com/o/r/actions/runs/{run_id}",
        "created_at": ts(hours_ago),
        "event": event,
        "conclusion": conclusion,
        "path": path,
        "name": name or path,
        "head_branch": f"gh-readonly-queue/main/pr-{pr}-{run_id:040d}" if event == "merge_group" else "feature",
    }


def zipped(name, payload):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as bundle:
        bundle.writestr(name, json.dumps(payload))
    return buffer.getvalue()


class FakeApi:
    """Serves run listings by `created` range and artifacts by name."""

    def __init__(self, runs=(), artifacts=(), downloads=None):
        self.runs = list(runs)
        self.artifacts = list(artifacts)
        self.downloads = downloads or {}
        self.calls = []

    def rest(self, path, params):
        self.calls.append((path, dict(params)))
        if path.endswith("/actions/artifacts"):
            batch = [a for a in self.artifacts if a["name"] == params["name"]]
            return {"artifacts": batch if params["page"] == 1 else []}
        lo, hi = (report.parse_ts(v) for v in params["created"].split(".."))
        matching = [
            r
            for r in self.runs
            if lo <= report.parse_ts(r["created_at"]) <= hi
            and r.get("event") == params.get("event", r.get("event"))
            and (not path.endswith("/runs") or "/workflows/" not in path or r["path"].endswith(path.split("/")[-2]))
        ]
        page = params["page"]
        return {
            "total_count": len(matching),
            "workflow_runs": matching[(page - 1) * 100 : page * 100][: report.LISTING_CAP],
        }

    def graphql(self, query, variables=None):
        raise AssertionError("durations are injected in these tests")

    def download(self, path):
        return self.downloads[path]


# ---------------------------------------------------------------- small pieces


def test_queue_entry_pr_reads_the_pr_number_from_the_queue_branch():
    assert report.queue_entry_pr("gh-readonly-queue/main/pr-34740-79d391a6") == 34740
    assert report.queue_entry_pr("gh-readonly-queue/release-1.9/pr-7-abc") == 7
    assert report.queue_entry_pr("main") is None
    assert report.queue_entry_pr(None) is None


def test_job_seconds_ignores_jobs_that_never_ran():
    assert report.job_seconds(
        [
            {"startedAt": "2026-10-08T00:00:00Z", "completedAt": "2026-10-08T00:10:00Z"},
            {"startedAt": "2026-10-08T00:00:00Z", "completedAt": None},
            {"startedAt": None, "completedAt": None},
            {"startedAt": "2026-10-08T00:05:00Z", "completedAt": "2026-10-08T00:05:00Z"},
        ]
    ) == 600


def test_durations_from_batch_reads_aliases_and_flags_more_pages():
    data = {
        "r0": {
            "checkSuite": {
                "id": "CS_0",
                "checkRuns": {
                    "pageInfo": {"hasNextPage": True, "endCursor": "c1"},
                    "nodes": [{"startedAt": "2026-10-08T00:00:00Z", "completedAt": "2026-10-08T01:00:00Z"}],
                },
            }
        },
        "r1": None,
    }

    seconds, more = report.durations_from_batch(data, [10, 11])

    assert seconds == {10: 3600}
    assert more == {10: ("CS_0", "c1")}


def test_batch_query_aliases_every_run_url():
    query = report.batch_query(["https://github.com/o/r/actions/runs/1", "https://github.com/o/r/actions/runs/2"])
    assert 'r0: resource(url: "https://github.com/o/r/actions/runs/1")' in query
    assert 'r1: resource(url: "https://github.com/o/r/actions/runs/2")' in query
    assert query.count("checkRuns(first: 100)") == 2


# ------------------------------------------------------------------ aggregation


def test_queue_metrics_counts_entries_per_pr_and_the_fail_rate():
    runs = [
        run(1, pr=10, conclusion="failure"),
        run(2, pr=10, conclusion="success"),
        run(3, pr=11, conclusion="failure"),
        run(4, pr=11, conclusion="cancelled"),
        run(5, pr=12, conclusion="success", hours_ago=30),  # outside 24h
        run(6, event="pull_request", conclusion="failure"),  # not a queue run
    ]

    metrics = report.queue_metrics(runs, NOW - timedelta(hours=24), NOW)

    assert metrics == {
        "runs": 4,
        "distinctPrs": 2,
        "entriesPerPr": 2.0,
        "succeeded": 1,
        "failed": 2,
        "cancelled": 1,
        "other": 0,
        "failRate": 0.667,
    }


def test_queue_metrics_with_no_runs_has_no_rates():
    metrics = report.queue_metrics([], NOW - timedelta(hours=24), NOW)
    assert metrics["entriesPerPr"] is None and metrics["failRate"] is None


def test_runner_hours_group_by_workflow_path_and_event():
    unit = ".github/workflows/unit.yml"
    runs = [
        run(1, event="pull_request", path=unit, name="Unit for PR #1"),
        run(2, event="pull_request_target", path=unit, name="Unit for PR #2"),
        run(3, event="merge_group", path=unit),
        run(4, event="schedule", path=unit),
        run(5, event="merge_group", path=QUEUE),
    ]
    durations = {1: 3600, 2: 1800, 3: 7200, 4: 360, 5: 30600}

    totals = report.rounded(report.runner_hours_by_workflow(runs, durations))

    assert totals[unit] == {
        "runs": 4,
        "hours": 3.6,
        "byEvent": {"pr": 1.5, "queue": 2.0, "other": 0.1},
        "unmeasured": 0,
    }
    assert totals[QUEUE]["hours"] == 8.5


def test_a_run_without_job_data_is_unmeasured_not_zero():
    totals = report.runner_hours_by_workflow([run(1), run(2)], {1: 3600})
    assert totals[QUEUE]["runs"] == 2
    assert totals[QUEUE]["unmeasured"] == 1
    assert totals[QUEUE]["hours"] == 1.0


def daily(hours_ago_end, hours=1.0, length=24):
    end = NOW - timedelta(hours=hours_ago_end)
    return {
        "window": {"start": report.iso(end - timedelta(hours=length)), "end": report.iso(end)},
        "runnerHours": {
            QUEUE: {"runs": 1, "hours": hours, "byEvent": {"pr": 0.0, "queue": hours, "other": 0.0}, "unmeasured": 0}
        },
    }


def test_week_rollup_sums_daily_reports_and_skips_overlaps_and_old_days():
    reports = [
        daily(0, hours=1),
        daily(2, hours=50),  # a manual dispatch overlapping today: dropped
        daily(24, hours=2),
        daily(48, hours=3),
        daily(24 * 7, hours=99),  # window starts before the week: dropped
    ]

    chosen = report.select_daily_reports(reports, NOW - timedelta(days=7))
    totals, covered = report.rollup_runner_hours(chosen)

    assert [r["runnerHours"][QUEUE]["hours"] for r in chosen] == [1, 2, 3]
    assert totals[QUEUE]["hours"] == 6
    assert totals[QUEUE]["byEvent"]["queue"] == 6
    assert covered == 72


def test_top_flaky_counts_each_run_once_per_test():
    a = {"spec": "Features/A.spec.ts", "title": "Panel › opens"}
    b = {"spec": "Pages/B.spec.ts", "title": "loads"}
    payloads = [{"tests": [a, b, a]}, {"tests": [a]}, {"tests": []}]

    assert report.top_flaky(payloads) == [
        {"spec": "Features/A.spec.ts", "title": "Panel › opens", "runs": 2},
        {"spec": "Pages/B.spec.ts", "title": "loads", "runs": 1},
    ]


# ---------------------------------------------------------------------- listing


def test_a_full_listing_slice_is_split_until_it_fits(monkeypatch):
    monkeypatch.setattr(report, "LISTING_CAP", 3)
    runs = [run(i, hours_ago=i * 0.5) for i in range(1, 9)]
    api = FakeApi(runs)

    listed = report.list_runs(api, "repos/o/r/actions/runs", NOW - timedelta(hours=5), NOW, {"event": "merge_group"})

    assert [r["id"] for r in listed] == list(range(1, 9))
    assert all(call[1]["status"] == "completed" for call in api.calls)


# ------------------------------------------------------------------ whole report


def test_build_report_and_render_from_fixtures():
    unit = ".github/workflows/unit.yml"
    runs = [
        run(1, pr=10, conclusion="failure"),
        run(2, pr=10),
        run(3, pr=11, hours_ago=48, conclusion="failure"),
        run(4, event="pull_request", path=unit),
        run(5, event="pull_request", path=unit, conclusion="skipped"),
    ]
    previous = {"today": daily(24, hours=4)}
    flaky = {"tests": [{"spec": "Features/A.spec.ts", "title": "Panel › opens"}]}
    artifacts = [
        {"id": 100, "name": "ci-health-report", "created_at": ts(24), "expired": False},
        {
            "id": 200,
            "name": "playwright-flaky-tests",
            "created_at": ts(1),
            "expired": False,
            "workflow_run": {"head_branch": "gh-readonly-queue/main/pr-10-abc"},
        },
        {
            "id": 201,
            "name": "playwright-flaky-tests",
            "created_at": ts(1),
            "expired": False,
            "workflow_run": {"head_branch": "feature"},  # a PR run: not the queue
        },
    ]
    api = FakeApi(
        runs,
        artifacts,
        {
            "repos/o/r/actions/artifacts/100/zip": zipped("ci-health.json", previous),
            "repos/o/r/actions/artifacts/200/zip": zipped("playwright-flaky-tests.json", flaky),
        },
    )
    measured = []

    def durations(_, listed):
        measured.extend(r["id"] for r in listed)
        return {r["id"]: 3600 for r in listed}

    built = report.build_report(api, "o", "r", NOW, durations=durations)

    assert sorted(measured) == [1, 2, 4]  # skipped runs are never measured
    assert built["queue"]["24h"]["runs"] == 2
    assert built["queue"]["7d"]["runs"] == 3
    assert built["queue"]["7d"]["failRate"] == 0.667
    assert built["runnerHours"]["24h"][QUEUE]["hours"] == 2.0
    assert built["runnerHours"]["7d"][QUEUE]["hours"] == 6.0
    assert built["weekCoverage"] == {"reports": 2, "hours": 48.0}
    assert built["flaky"] == {
        "artifacts": 1,
        "readable": 1,
        "tests": [{"spec": "Features/A.spec.ts", "title": "Panel › opens", "runs": 1}],
    }
    assert built["today"]["runnerHours"] == built["runnerHours"]["24h"]

    markdown = report.render_markdown(built)
    assert "| 24h | 2 | 1 | 2.0 | 1 | 1 | 0 | 50.0% |" in markdown
    assert "| playwright-postgresql-e2e.yml | 2.0 | 2 | 0.0 | 2.0 | 6.0 | 3 |" in markdown
    assert "2 daily report(s) covering 48 of 168 hours" in markdown
    assert "| `Features/A.spec.ts` › Panel › opens | 1 |" in markdown


def test_render_says_when_no_flaky_artifacts_exist():
    built = {
        "generatedAt": report.iso(NOW),
        "queueWorkflow": QUEUE,
        "queue": {w: report.queue_metrics([], NOW - timedelta(days=7), NOW) for w in ("24h", "7d")},
        "runnerHours": {"24h": {}, "7d": {}},
        "weekCoverage": {"reports": 1, "hours": 24.0},
        "flaky": {"artifacts": 0, "readable": 0, "tests": []},
    }

    markdown = report.render_markdown(built)

    assert "No `playwright-flaky-tests` artifacts" in markdown
    assert "| 24h | 0 | 0 | n/a |" in markdown
