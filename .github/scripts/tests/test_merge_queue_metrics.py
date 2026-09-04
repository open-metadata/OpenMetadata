"""Tests for the merge-queue health alert and daily digest.

Fixtures mirror payload shapes observed live on open-metadata/OpenMetadata, including
the two that silently corrupt the numbers: a `totalCount` that ignores its type filter,
and a PR that merged without ever entering the queue.
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).parents[1]


def load_script(name: str):
    # Registering in sys.modules *before* exec_module is what lets merge_queue_alert's
    # `import merge_queue_metrics` resolve — the dependency is already loaded by name,
    # so no sys.path manipulation is needed here.
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mq = load_script("merge_queue_metrics")
alert = load_script("merge_queue_alert")
daily = load_script("merge_queue_daily_report")

NOW = datetime(2026, 9, 4, 18, 0, tzinfo=timezone.utc)
WEEK_AGO = NOW - timedelta(days=7)


def _pr(number, merged_at=None, adds=(), removals=(), merged=None, total_count=64):
    """`total_count` is the trap: GitHub returns the PR's whole timeline size here
    regardless of the itemTypes filter, so it is set high even when nodes is empty."""
    return {
        "number": number,
        "url": f"https://github.com/o/r/pull/{number}",
        "merged": merged if merged is not None else merged_at is not None,
        "mergedAt": merged_at,
        "adds": {"totalCount": total_count,
                 "nodes": [{"createdAt": ts} for ts in adds]},
        "removals": {"totalCount": total_count, "nodes": list(removals)},
    }


def _removal(created, reason, oid=None):
    return {"createdAt": created, "reason": reason,
            "beforeCommit": {"oid": oid} if oid else None}


# ------------------------------------------------------------------ the traps


def test_bypassed_pr_is_not_counted_as_enqueued_despite_totalCount():
    # Observed on #32618: merged directly, zero queue events, totalCount 64.
    pr = _pr(32618, merged_at="2026-09-04T16:23:04Z", adds=(), total_count=64)
    result = mq.realized_metrics([pr], WEEK_AGO, NOW)

    assert result["merged_bypassing"] == 1
    assert result["merged_via_queue"] == 0
    assert result["first_pass_rate"] is None


def test_merge_removal_reason_is_excluded_from_failures():
    # A successful merge is encoded as a REMOVAL with reason "merged"; counting it as
    # a dequeue would report a ~100% failure rate.
    pr = _pr(
        1, merged_at="2026-09-04T14:57:13Z", adds=("2026-09-04T13:05:08Z",),
        removals=[_removal("2026-09-04T12:00:00Z", "manual"),
                  _removal("2026-09-04T14:57:13Z", "merged")],
    )
    result = mq.realized_metrics([pr], WEEK_AGO, NOW)

    assert result["dequeue_reasons"] == {"manual": 1, "merged": 1}
    assert result["non_merge_dequeues"] == 1


# ------------------------------------------------------------------- latency


def test_requeue_penalty_separates_total_wait_from_a_clean_pass():
    # Real shape of #32594: enqueued, dequeued "manual", re-enqueued, merged.
    pr = _pr(
        32594, merged_at="2026-09-04T14:57:13Z",
        adds=("2026-09-04T10:57:36Z", "2026-09-04T13:05:08Z"),
        removals=[_removal("2026-09-04T13:00:00Z", "manual"),
                  _removal("2026-09-04T14:57:13Z", "merged")],
    )
    result = mq.realized_metrics([pr], WEEK_AGO, NOW)

    assert round(result["total_p50_h"], 2) == 3.99
    assert round(result["first_pass_p50_h"], 2) == 1.87
    assert round(result["requeue_penalty_h"], 2) == 2.13
    assert result["enqueues_per_merge"] == 2.0
    assert result["wasted_passes"] == 1
    assert result["first_pass_rate"] == 0.0


def test_first_pass_rate_and_throughput_over_a_mixed_window():
    prs = [
        _pr(1, merged_at="2026-09-04T12:00:00Z", adds=("2026-09-04T10:00:00Z",)),
        _pr(2, merged_at="2026-09-04T13:00:00Z", adds=("2026-09-04T09:00:00Z",
                                                       "2026-09-04T11:00:00Z")),
        _pr(3, merged_at="2026-09-04T14:00:00Z", adds=("2026-09-04T13:00:00Z",)),
        _pr(4, merged_at="2026-09-04T15:00:00Z", adds=()),
    ]
    result = mq.realized_metrics(prs, NOW - timedelta(hours=24), NOW)

    assert result["merged_via_queue"] == 3
    assert result["merged_bypassing"] == 1
    assert round(result["first_pass_rate"], 3) == round(2 / 3, 3)
    assert round(result["throughput_per_h"], 4) == round(3 / 24, 4)


def test_events_outside_the_window_are_ignored():
    pr = _pr(1, merged_at="2026-08-01T00:00:00Z", adds=("2026-07-31T00:00:00Z",),
             removals=[_removal("2026-08-01T00:00:00Z", "failed_checks", "abc")])
    result = mq.realized_metrics([pr], NOW - timedelta(hours=24), NOW)

    assert result["merged_via_queue"] == 0
    assert result["dequeue_reasons"] == {}
    assert result["failed_commits"] == []


def test_matrix_check_names_collapse_to_the_shard_id():
    raw = ("playwright / playwright-ci "
           "(chromium-05, chromium-05.json, 3, chromium, false)")
    assert mq.shorten_check_name(raw) == "playwright / playwright-ci (chromium-05)"
    assert mq.shorten_check_name("playwright-summary") == "playwright-summary"


def test_untrusted_check_names_cannot_inject_slack_markup():
    # Check names are attacker-influenceable: a merge-group commit runs the workflows
    # in the merge group, so a PR can name a job whatever it likes.
    hostile = "build` <!channel> <https://evil.test|click me> &"
    safe = mq.sanitize_external(hostile)

    assert "`" not in safe
    assert "<" not in safe and ">" not in safe
    assert safe == "build' &lt;!channel&gt; &lt;https://evil.test|click me&gt; &amp;"


def test_sanitize_escapes_ampersand_before_angle_brackets():
    # Wrong order would double-escape into &amp;lt;
    assert mq.sanitize_external("a<b") == "a&lt;b"
    assert mq.sanitize_external("a&lt;b") == "a&amp;lt;b"


def test_client_errors_are_not_retried_but_server_errors_are():
    assert mq._retryable(mq.ApiError("403", status=403)) is False
    assert mq._retryable(mq.ApiError("404", status=404)) is False
    assert mq._retryable(mq.ApiError("429", status=429)) is True
    assert mq._retryable(mq.ApiError("502", status=502)) is True
    assert mq._retryable(TimeoutError("network")) is True


def test_a_non_retryable_error_raises_immediately_without_backoff():
    calls = []

    def failing():
        calls.append(1)
        raise mq.ApiError("HTTP 403 Forbidden", status=403)

    try:
        mq._retrying(failing, attempts=3, backoff=0)
    except mq.ApiError as exc:
        assert exc.status == 403
    assert len(calls) == 1, "a 403 must not be retried three times"


def test_gc_d_commit_is_skipped_but_a_denied_read_is_never_silent(monkeypatch):
    monkeypatch.setattr(
        mq, "rest", lambda *_: (_ for _ in ()).throw(mq.ApiError("gone", status=404)))
    assert mq.top_failing_checks(["deadbee"], "o", "r", "t") == [], \
        "a GC'd queue commit is expected and must not sink the report"

    monkeypatch.setattr(
        mq, "rest", lambda *_: (_ for _ in ()).throw(mq.ApiError("denied", status=403)))
    with pytest.raises(mq.CheckAccessError, match="checks: read"):
        mq.top_failing_checks(["deadbee"], "o", "r", "t")


def test_failing_check_tally_shortens_and_sanitizes(monkeypatch):
    payload = {"check_runs": [
        {"name": "playwright / ci (chromium-05, x.json, 3, chromium, false)",
         "conclusion": "failure"},
        {"name": "evil` <!channel>", "conclusion": "failure"},
        {"name": "unit-tests", "conclusion": "success"},
    ]}
    monkeypatch.setattr(mq, "rest", lambda *_: payload)

    assert mq.top_failing_checks(["abc"], "o", "r", "t") == [
        ("evil' &lt;!channel&gt;", 1),
        ("playwright / ci (chromium-05)", 1),
    ]


def test_healthy_window_end_date_is_inclusive():
    # `2026-08-28..2026-08-31` must cover the 31st. Ending at its midnight drops a
    # whole day of the reference sample without any visible signal.
    assert daily._date("2026-08-28") == datetime(2026, 8, 28, tzinfo=timezone.utc)
    end = daily._date("2026-08-31", end_of_day=True)
    assert end.date() == datetime(2026, 8, 31).date()
    assert end.hour == 23 and end.minute == 59

    merged_on_the_last_day = datetime(2026, 8, 31, 10, 0, tzinfo=timezone.utc)
    assert daily._date("2026-08-28") <= merged_on_the_last_day <= end

    assert daily._date("") is None
    assert daily._date("", end_of_day=True) is None


def test_percentile_of_empty_sample_is_none_not_an_error():
    assert mq.percentile([], 0.5) is None
    assert mq.percentile([1.0, 2.0, 3.0, 4.0], 0.5) == 3.0


# ---------------------------------------------------------------- live queue


def _queue(entries, next_eta=49046):
    return {"nextEntryEstimatedTimeToMerge": next_eta,
            "entries": {"totalCount": len(entries), "nodes": entries}}


def _entry(position, eta, enqueued, state="QUEUED", number=None):
    return {"position": position, "estimatedTimeToMerge": eta, "enqueuedAt": enqueued,
            "state": state,
            "pullRequest": {"number": number or position, "title": "t",
                            "url": f"https://github.com/o/r/pull/{number or position}"}}


def test_queue_metrics_recovers_service_step_and_head_age():
    # Observed ladder: constant 1199s per position.
    queue = _queue([
        _entry(1, 7560, "2026-09-03T20:07:16Z", "AWAITING_CHECKS"),
        _entry(2, 8759, "2026-09-03T21:00:00Z"),
        _entry(3, 9958, "2026-09-03T22:00:00Z"),
    ])
    metrics = mq.queue_metrics(queue, NOW)

    assert metrics["service_step_s"] == 1199
    assert round(metrics["head_entry_age_h"], 1) == 21.9
    assert round(metrics["github_rate_per_h"], 2) == 3.00
    assert metrics["states"] == {"AWAITING_CHECKS": 1, "QUEUED": 2}
    assert metrics["stuck_states"] == {}


def test_queue_metrics_flags_stuck_entries_and_handles_empty_queue():
    stuck = mq.queue_metrics(
        _queue([_entry(1, 100, "2026-09-04T17:00:00Z", "UNMERGEABLE")]), NOW)
    assert stuck["stuck_states"] == {"UNMERGEABLE": 1}

    empty = mq.queue_metrics(_queue([], next_eta=None), NOW)
    assert empty["depth"] == 0
    assert empty["head_entry_age_h"] is None
    assert empty["service_step_s"] is None


def test_projected_drain_uses_realized_rate_not_githubs():
    # Depth 34 at the realized 0.71/h is ~48h; GitHub's 3.0/h implies ~11h.
    assert round(mq.projected_drain_h(34, 0.71)) == 48
    assert mq.projected_drain_h(34, None) is None
    assert mq.projected_drain_h(0, 0.71) is None


# ------------------------------------------------------- alert state machine


def test_classify_thresholds_and_empty_queue():
    assert alert.classify(None, 5, 24) == "ok"
    assert alert.classify(4.9, 5, 24) == "ok"
    assert alert.classify(5.0, 5, 24) == "degraded"
    assert alert.classify(23.9, 5, 24) == "degraded"
    assert alert.classify(24.0, 5, 24) == "severe"


def test_first_breach_announces_then_stays_silent_while_breached():
    state = {"level": "ok", "since": None, "below_streak": 0}

    state, transition = alert.decide("degraded", state, 3, NOW)
    assert transition == "escalated"

    for _ in range(5):
        state, transition = alert.decide("degraded", state, 3, NOW)
        assert transition is None, "a level-triggered alert would fire every hour here"


def test_escalation_to_severe_still_announces_while_degraded():
    state = {"level": "degraded", "since": "2026-09-01T00:00:00+00:00", "below_streak": 0}
    state, transition = alert.decide("severe", state, 3, NOW)

    assert transition == "escalated"
    assert state["level"] == "severe"


def test_de_escalation_is_silent_because_it_is_still_broken():
    state = {"level": "severe", "since": "2026-09-01T00:00:00+00:00", "below_streak": 0}
    state, transition = alert.decide("degraded", state, 3, NOW)

    assert transition is None
    assert state["level"] == "degraded"


def test_recovery_requires_a_streak_and_a_single_good_run_does_not_clear_it():
    state = {"level": "degraded", "since": "2026-09-01T00:00:00+00:00", "below_streak": 0}

    state, transition = alert.decide("ok", state, 3, NOW)
    assert transition is None and state["level"] == "degraded"

    state, transition = alert.decide("ok", state, 3, NOW)
    assert transition is None and state["level"] == "degraded"

    state, transition = alert.decide("ok", state, 3, NOW)
    assert transition == "recovered" and state["level"] == "ok"


def test_a_breach_between_good_runs_resets_the_recovery_streak():
    state = {"level": "degraded", "since": "2026-09-01T00:00:00+00:00", "below_streak": 0}
    state, _ = alert.decide("ok", state, 3, NOW)
    state, _ = alert.decide("ok", state, 3, NOW)
    state, _ = alert.decide("degraded", state, 3, NOW)
    assert state["below_streak"] == 0

    state, transition = alert.decide("ok", state, 3, NOW)
    assert transition is None, "streak must restart, not resume at 2"


def test_lost_state_re_announces_a_standing_breach():
    # An Actions cache miss must not leave a broken queue silently unreported.
    missing = alert.load_state(Path("/nonexistent/merge-queue-state.json"))
    assert missing == {"level": "ok", "since": None, "below_streak": 0}

    _, transition = alert.decide("severe", missing, 3, NOW)
    assert transition == "escalated"


def test_state_is_unchanged_on_a_steady_run_so_the_cache_save_can_be_skipped():
    # Every save mints a new immutable cache entry; a steady queue must not write one.
    steady = {"level": "degraded", "since": "2026-09-01T00:00:00+00:00", "below_streak": 0}
    nxt, transition = alert.decide("degraded", steady, 3, NOW)

    assert transition is None
    assert nxt == steady, "an unchanged level must produce an identical state dict"


def test_recovery_streak_changes_state_so_it_still_gets_saved():
    state = {"level": "degraded", "since": "2026-09-01T00:00:00+00:00", "below_streak": 0}
    nxt, _ = alert.decide("ok", state, 3, NOW)

    assert nxt != state, "an advancing streak must be persisted or it restarts hourly"
    assert nxt["below_streak"] == 1


def test_healthy_queue_stays_quiet():
    state = {"level": "ok", "since": None, "below_streak": 0}
    for _ in range(5):
        state, transition = alert.decide("ok", state, 3, NOW)
        assert transition is None
