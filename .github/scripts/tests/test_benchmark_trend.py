"""Tests for benchmark_trend.py and benchmark_trend_svg.py."""

from __future__ import annotations

import importlib.util
import json
import sys
import xml.etree.ElementTree as ElementTree
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


trend = load_script("benchmark_trend")
svg = load_script("benchmark_trend_svg")

SETTINGS = trend.Settings(baseline_runs=7, min_history=5, tolerance_pct=25, noise_floor_ms=25)


def _latency(p95: int, samples: int = 20) -> dict:
    return {
        "p50Millis": p95,
        "p95Millis": p95,
        "p99Millis": p95,
        "maxMillis": p95,
        "meanMillis": float(p95),
        "sampleCount": samples,
        "warmupCount": 0,
    }


def _lineage(latencies: dict[str, int]) -> dict:
    return {
        "schemaVersion": 1,
        "benchmarkId": "lineage-scene-scale",
        "gitSha": "abcdef1234567890",
        "serverVersion": "2.1.0",
        "timestampUtc": "2026-10-09T00:00:00Z",
        "params": {"tables": 50000, "edges": 50000},
        "latencies": {name: _latency(value) for name, value in latencies.items()},
        "counters": {},
    }


def _api(suite: str, routes: dict[str, tuple[int, int]]) -> dict:
    """routes: route -> (p95, calls)."""
    return {
        "schemaVersion": 1,
        "benchmarkId": "api-latency",
        "gitSha": "abcdef1234567890",
        "serverVersion": "unknown",
        "timestampUtc": "2026-10-09T00:00:00Z",
        "params": {"suite": suite, "mode": "external"},
        "latencies": {route: _latency(p95, calls) for route, (p95, calls) in routes.items()},
        "counters": {"requests": sum(calls for _, calls in routes.values())},
    }


def _run(run_id: str, day: int, ref: str = "main") -> trend.RunInfo:
    return trend.RunInfo(run_id=run_id, started_at=f"2026-10-{day:02d}T03:00:00+00:00", ref=ref)


def _seed_history(root: Path, nights: list[dict]) -> trend.History:
    history = trend.History(root)
    for night, report in enumerate(nights, start=1):
        history.record(_run(f"r{night}", night), [report], keep_runs=120)
    return history


# ---------------------------------------------------------------- series and sparkline


def test_a_lineage_report_is_keyed_by_its_cohort_size():
    assert trend.series_key(_lineage({"root-layer-warm": 10})) == "lineage-scene-scale/50000-tables"


def test_an_api_report_is_keyed_by_its_suite():
    assert trend.series_key(_api("ui-it-embedded-opensearch", {})) == "api-latency/ui-it-embedded-opensearch"


def test_sparkline_scales_to_the_window_and_marks_missing_nights():
    assert trend.sparkline([100, None, 200, 150]) == "▁·█▅"


def test_a_flat_sparkline_sits_mid_height():
    assert trend.sparkline([40, 40, 40]) == "▅▅▅"


# ---------------------------------------------------------------- verdicts


def test_nothing_is_judged_before_enough_history(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"focused-hub-asset": 100})] * 3)

    [result] = trend.compare_run(history, _run("now", 9), [_lineage({"focused-hub-asset": 900})], SETTINGS)

    assert result.rows[0].verdict == "warming up (3/5)"
    assert result.regressions == []


def test_flags_a_scenario_past_tolerance_against_the_median(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"focused-hub-asset": 100})] * 6)

    [result] = trend.compare_run(history, _run("now", 9), [_lineage({"focused-hub-asset": 200})], SETTINGS)

    row = result.rows[0]
    assert row.verdict == trend.REGRESSED_LABEL
    assert row.baseline == 100
    assert row.change_pct == pytest.approx(100.0)


def test_one_noisy_night_does_not_move_the_baseline(tmp_path):
    nights = [_lineage({"focused-hub-asset": value}) for value in (100, 100, 5000, 100, 100, 100)]
    history = _seed_history(tmp_path, nights)

    [result] = trend.compare_run(history, _run("now", 9), [_lineage({"focused-hub-asset": 110})], SETTINGS)

    assert result.rows[0].baseline == 100
    assert result.rows[0].verdict == trend.UNCHANGED_LABEL


def test_a_large_percentage_under_the_noise_floor_is_unchanged(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"root-layer-warm": 4})] * 6)

    [result] = trend.compare_run(history, _run("now", 9), [_lineage({"root-layer-warm": 20})], SETTINGS)

    assert result.rows[0].verdict == trend.UNCHANGED_LABEL


def test_reports_an_improvement(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"focused-hub-asset": 1000})] * 6)

    [result] = trend.compare_run(history, _run("now", 9), [_lineage({"focused-hub-asset": 400})], SETTINGS)

    assert result.rows[0].verdict == trend.IMPROVED_LABEL


def test_a_route_with_too_few_calls_is_not_judged(tmp_path):
    history = _seed_history(tmp_path, [_api("ui-it", {"sdk GET /v1/tables": (10, 2)})] * 6)

    [result] = trend.compare_run(
        history, _run("now", 9), [_api("ui-it", {"sdk GET /v1/tables": (900, 2)})], SETTINGS
    )

    assert result.rows[0].verdict == trend.FEW_SAMPLES_LABEL


def test_a_rerun_of_the_same_night_is_not_its_own_baseline(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"focused-hub-asset": 100})] * 6)
    rerun = _run("now", 9)
    history.record(rerun, [_lineage({"focused-hub-asset": 300})], keep_runs=120)

    [result] = trend.compare_run(history, rerun, [_lineage({"focused-hub-asset": 300})], SETTINGS)

    assert result.rows[0].baseline == 100
    assert result.rows[0].verdict == trend.REGRESSED_LABEL


# ---------------------------------------------------------------- history


def test_recording_a_run_id_again_replaces_it(tmp_path):
    history = trend.History(tmp_path)
    history.record(_run("42", 1), [_lineage({"a": 1})], keep_runs=10)
    history.record(_run("42", 1), [_lineage({"a": 2})], keep_runs=10)

    runs = history.load("main")

    assert len(runs) == 1
    assert runs[0].reports["lineage-scene-scale/50000-tables"]["latencies"]["a"]["p95Millis"] == 2


def test_history_is_pruned_to_the_newest_runs(tmp_path):
    history = trend.History(tmp_path)
    for day in range(1, 6):
        history.record(_run(f"r{day}", day), [_lineage({"a": day})], keep_runs=3)

    assert [run.info.run_id for run in history.load("main")] == ["r3", "r4", "r5"]


def test_refs_are_kept_apart(tmp_path):
    history = trend.History(tmp_path)
    history.record(_run("1", 1, ref="main"), [_lineage({"a": 1})], keep_runs=10)
    history.record(_run("2", 1, ref="2.0"), [_lineage({"a": 1})], keep_runs=10)

    assert history.refs() == ["2.0", "main"]
    assert len(history.load("2.0")) == 1


# ---------------------------------------------------------------- outputs


def test_summary_shows_busy_routes_and_every_regressed_quiet_one(tmp_path):
    busy = {f"sdk GET /v1/r{index}": (50, 1000 - index) for index in range(30)}
    quiet = {"sdk GET /v1/quiet": (100, 6)}
    history = _seed_history(tmp_path, [_api("ui-it", {**busy, **quiet})] * 6)
    current = _api("ui-it", {**busy, "sdk GET /v1/quiet": (900, 6)})

    results = trend.compare_run(history, _run("now", 9), [current], SETTINGS)
    summary = trend.render_summary(_run("now", 9), results, SETTINGS, None)

    assert "`sdk GET /v1/r0`" in summary
    assert "`sdk GET /v1/r29`" not in summary
    assert "`sdk GET /v1/quiet`" in summary
    assert "5 quieter routes omitted" in summary


def test_slack_payload_leads_with_the_regression_count(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"focused-hub-asset": 100})] * 6)
    results = trend.compare_run(history, _run("now", 9), [_lineage({"focused-hub-asset": 300})], SETTINGS)

    payload = trend.render_slack(_run("now", 9), results, "https://example.test/trends")

    assert payload["text"] == "Nightly latency · main: 1 regression(s)"
    assert "focused-hub-asset" in json.dumps(payload)


def test_trends_page_draws_every_scenario_in_both_themes_with_its_values(tmp_path):
    scenarios = {"root-layer-warm": 8, "focused-hub-asset": 3100, "interaction-fit-to-screen": 120}
    history = _seed_history(tmp_path, [_lineage(scenarios)] * 3)

    trend.write_trends(history, tmp_path, SETTINGS, _run("r3", 3))

    page = (tmp_path / "TRENDS.md").read_text()
    charts = sorted((tmp_path / "charts").rglob("*.svg"))
    assert "#### Scene API — root scenes" in page
    assert "#### Scene API — focused scenes" in page
    assert "#### Lineage map — zoom and view" in page
    assert page.count('<source media="(prefers-color-scheme: dark)"') == 3
    assert "| 10-03 | 3,100 ms |" in page
    assert len(charts) == 6
    for chart in charts:
        ElementTree.parse(chart)


def test_the_lineage_benchmark_leads_the_page_and_the_summary(tmp_path):
    history = _seed_history(tmp_path, [_lineage({"a": 1}), _api("ui-it", {"sdk GET /v1/tables": (5, 50)})])

    trend.write_trends(history, tmp_path, SETTINGS, _run("r2", 2))

    page = (tmp_path / "TRENDS.md").read_text()
    assert page.index("### lineage-scene-scale") < page.index("### api-latency")


def test_a_gated_regression_fails_the_run(tmp_path):
    history_dir = tmp_path / "history"
    _seed_history(history_dir, [_lineage({"focused-hub-asset": 100})] * 6)
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "lineage-scene-scale-50000.json").write_text(json.dumps(_lineage({"focused-hub-asset": 400})))
    args = ["--reports", str(reports), "--history", str(history_dir), "--ref", "main", "--run-id", "now"]

    assert trend.main([*args, "--summary-out", str(tmp_path / "s.md")]) == 0
    assert trend.main([*args, "--gate", "lineage-scene-scale", "--fail-on-regression"]) == 1
    assert trend.main([*args, "--gate", "api-latency", "--fail-on-regression"]) == 0


def test_refuses_a_report_from_an_unknown_schema(tmp_path):
    reports = tmp_path / "reports"
    reports.mkdir()
    report = _lineage({"a": 1})
    report["schemaVersion"] = 99
    (reports / "x.json").write_text(json.dumps(report))

    assert trend.main(["--reports", str(reports), "--history", str(tmp_path / "h"), "--ref", "main"]) == 2


def test_skips_bare_metrics_files(tmp_path):
    (tmp_path / "scale-100k.json").write_text(json.dumps({"tables": 100000, "seconds": 12}))
    (tmp_path / "lineage.json").write_text(json.dumps(_lineage({"a": 1})))

    assert [report["benchmarkId"] for report in trend.load_reports([tmp_path])] == ["lineage-scene-scale"]


# ---------------------------------------------------------------- svg


def test_a_missing_night_breaks_the_line():
    chart = svg.Chart("t", ["10-01", "10-02", "10-03", "10-04"], [svg.Series("s", [10, None, 30, 40])])

    document = svg.render(chart, "light")

    assert document.count("<polyline") == 2


def test_axis_ticks_are_round_numbers():
    assert svg.nice_step(1167) == 2000
    assert svg.nice_step(72.5) == 100
    assert svg.nice_step(10.25) == 20
    assert svg.nice_step(0.4) == 0.5


def test_lineage_scenarios_follow_the_chart_groups():
    report = _lineage({"interaction-fit-to-screen": 1, "focused-hub-asset": 1, "root-layer-warm": 1})

    assert trend._ordered_scenarios(report) == [
        "root-layer-warm",
        "focused-hub-asset",
        "interaction-fit-to-screen",
    ]


def test_refuses_more_series_than_hues():
    chart = svg.Chart("t", ["10-01"], [svg.Series(f"s{index}", [1]) for index in range(9)])

    with pytest.raises(ValueError):
        svg.render(chart, "dark")
