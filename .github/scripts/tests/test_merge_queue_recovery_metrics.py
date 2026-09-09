import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "merge_queue_metrics", Path(__file__).parents[1] / "merge_queue_metrics.py"
)
mq = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mq
SPEC.loader.exec_module(mq)


def check(name, conclusion="failure", run=12):
    return {
        "name": name,
        "conclusion": conclusion,
        "details_url": f"https://github.com/o/r/actions/runs/{run}/job/99",
    }


def test_paginates_checks_and_counts_one_incident_per_workflow(monkeypatch):
    first_page = [check(f"irrelevant-{i}", "success") for i in range(100)]
    pages = [
        first_page,
        [
            check("playwright-ci (chromium-01)"),
            check("playwright-summary"),
            check("abandoned", "cancelled", 13),
        ],
    ]
    requests = []

    def rest(path, token):
        requests.append(path)
        return {"total_count": 103, "check_runs": pages.pop(0)}

    monkeypatch.setattr(mq, "rest", rest)
    assert mq.top_failing_checks(["sha", "sha"], "o", "r", "token") == [
        ("Playwright E2E", 1)
    ]
    assert "page=2" in requests[1]


def test_cancellation_is_not_attributed_as_test_failure():
    assert mq.classify_check_evidence([check("playwright-ci", "cancelled")]) == {
        "directFailures": [],
        "cancelled": 1,
    }


def test_report_pairs_do_not_double_count_and_keep_job_links():
    evidence = mq.classify_check_evidence(
        [check("playwright-summary"), check("playwright-ci (chromium-02)")]
    )
    assert len(evidence["directFailures"]) == 1
    assert evidence["directFailures"][0]["jobUrl"].endswith("/job/99")


def test_raw_test_counts_distinguish_retry_passes_and_unknown_coverage():
    reports = [
        {
            "totals": {"passed": 8, "failed": 1, "flaky": 2, "skipped": 1},
            "measurement": {
                "firstAttemptPassed": 8,
                "firstAttemptFailed": 3,
                "retriedTests": 2,
                "quarantinedTests": 4,
            },
        },
        None,
    ]
    result = mq.aggregate_test_reports(reports)
    assert result["firstAttemptPassed"] == 8
    assert result["firstAttemptFailed"] == 3
    assert result["retriedTests"] == 2
    assert result["missingReports"] == 1
    assert result["quarantinedTests"] == 4
    assert result["unverifiedCoverageReports"] == 1
    assert result["unverifiedIntegrityReports"] == 1


def test_local_shard_gate_preserves_first_failure_after_a_workflow_rerun(monkeypatch):
    def pages(path, key, token):
        if key == "workflow_runs":
            return [
                {
                    "id": 12,
                    "head_sha": "sha",
                    "conclusion": "success",
                    "status": "completed",
                    "run_attempt": 2,
                    "created_at": "2026-09-09T00:00:00Z",
                }
            ]
        if key == "artifacts":
            return []
        assert path.endswith("/attempts/1/jobs")
        return [
            {
                "steps": [
                    {
                        "name": "Gate verified merge-group shards",
                        "conclusion": "failure",
                    }
                ]
            }
        ]

    monkeypatch.setattr(mq, "paginated_items", pages)
    monkeypatch.setattr(
        mq,
        "rest",
        lambda path, token: {"conclusion": "failure", "status": "completed"},
    )
    now = datetime.now(timezone.utc)
    reports, warnings = mq.playwright_window_reports("o", "r", "token", now, now)
    assert warnings == []
    assert reports[0]["conclusion"] == "failure"
    assert reports[0]["latestConclusion"] == "success"
    assert reports[0]["shardGateConclusion"] == "failure"
    assert reports[0]["reportExpected"] is False
    assert reports[0]["report"] is None


@pytest.mark.parametrize("pending", [True, False])
def test_unavailable_first_attempt_evidence_never_becomes_a_pass(monkeypatch, pending):
    run = {
        "id": 12,
        "head_sha": "sha",
        "conclusion": None if pending else "success",
        "status": "in_progress" if pending else "completed",
        "run_attempt": 1 if pending else 2,
        "created_at": "2026-09-09T00:00:00Z",
    }
    monkeypatch.setattr(mq, "paginated_items", lambda *args: [run])

    def unavailable(path, token):
        raise mq.ApiError("First attempt unavailable")

    def unexpected_download(*args):
        pytest.fail("Do not download reports for an incomplete or unavailable attempt")

    monkeypatch.setattr(mq, "rest", unavailable)
    monkeypatch.setattr(mq, "read_summary_artifact", unexpected_download)
    now = datetime.now(timezone.utc)
    reports, warnings = mq.playwright_window_reports("o", "r", "token", now, now)
    assert reports[0]["conclusion"] is None
    assert reports[0]["reportExpected"] is None
    assert bool(warnings) is not pending


def test_summary_transport_failure_is_reported_without_repeating_download(monkeypatch):
    monkeypatch.setattr(
        mq,
        "paginated_items",
        lambda *args: [{"name": "playwright-shadow-gate-postgresql-pr-12-1", "id": 13}],
    )
    downloads = []

    def download(*args, **kwargs):
        downloads.append(args[0])
        return mq.subprocess.CompletedProcess(
            args[0], 1, stdout=b"", stderr=b"ECONNRESET"
        )

    monkeypatch.setattr(mq.subprocess, "run", download)
    with pytest.raises(mq.ApiError, match="download"):
        mq.read_summary_artifact(12, "o", "r", "token")
    assert len(downloads) == 1
