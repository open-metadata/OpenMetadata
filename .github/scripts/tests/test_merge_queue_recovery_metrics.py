import importlib.util
import sys
from pathlib import Path

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
