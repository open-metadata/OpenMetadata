"""Tests for compare_benchmark_metrics.py."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


cmp = load_script("compare_benchmark_metrics")


def _report(latencies: dict[str, int], *, schema_version: int = 1, **overrides) -> dict:
    report = {
        "schemaVersion": schema_version,
        "benchmarkId": "lineage-scene-scale",
        "gitSha": "abcdef1234567890",
        "serverVersion": "2.0.0",
        "timestampUtc": "2026-09-23T00:00:00Z",
        "params": {"tables": 50000, "edges": 50000},
        "latencies": {
            name: {
                "p50Millis": value,
                "p95Millis": value,
                "p99Millis": value,
                "maxMillis": value,
                "meanMillis": float(value),
                "sampleCount": 20,
                "warmupCount": 5,
            }
            for name, value in latencies.items()
        },
        "counters": {},
    }
    report.update(overrides)
    return report


def _write(tmp_path: Path, name: str, report: dict) -> Path:
    directory = tmp_path / name
    directory.mkdir()
    (directory / "lineage-scene-scale-50000.json").write_text(json.dumps(report))
    return directory


def test_reports_no_change_when_both_runs_match(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 900}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 900}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    assert output["regressionCount"] == 0
    assert output["comparisons"][0]["scenarios"][0]["verdict"] == cmp.UNCHANGED_LABEL


def test_flags_a_scenario_that_grew_past_the_tolerance(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 1000}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 1400}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    assert output["regressionCount"] == 1
    row = output["comparisons"][0]["scenarios"][0]
    assert row["verdict"] == cmp.REGRESSED_LABEL
    assert row["changePct"] == pytest.approx(40.0)


def test_growth_inside_the_tolerance_is_not_a_regression(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 1000}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 1200}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    assert output["regressionCount"] == 0


def test_reports_an_improvement(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 1000}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 400}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    assert output["comparisons"][0]["scenarios"][0]["verdict"] == cmp.IMPROVED_LABEL


def test_millisecond_noise_on_a_warm_scene_is_not_a_regression(tmp_path):
    """1ms -> 3ms is +200% and means nothing; the absolute floor must absorb it."""
    baseline = _write(tmp_path, "a", _report({"root-layer-warm": 1}))
    candidate = _write(tmp_path, "b", _report({"root-layer-warm": 3}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    assert output["regressionCount"] == 0
    assert output["comparisons"][0]["scenarios"][0]["verdict"] == cmp.UNCHANGED_LABEL


def test_zero_baseline_with_a_real_regression_is_still_flagged(tmp_path):
    baseline = _write(tmp_path, "a", _report({"root-layer-warm": 0}))
    candidate = _write(tmp_path, "b", _report({"root-layer-warm": 800}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    row = output["comparisons"][0]["scenarios"][0]
    assert row["verdict"] == cmp.REGRESSED_LABEL
    assert row["changePct"] is None


def test_output_is_json_serializable(tmp_path):
    """A non-finite changePct would produce output no downstream step can parse."""
    baseline = _write(tmp_path, "a", _report({"root-layer-warm": 0, "focused-hub-asset": 900}))
    candidate = _write(tmp_path, "b", _report({"root-layer-warm": 800, "focused-hub-asset": 950}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    assert json.loads(json.dumps(output, allow_nan=False)) == output


def test_a_scenario_added_in_the_candidate_is_reported_not_compared(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 900}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 900, "focused-hub-field": 50}))

    output = cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)

    rows = {row["scenario"]: row for row in output["comparisons"][0]["scenarios"]}
    assert rows["focused-hub-field"]["verdict"] == "n/a"
    assert rows["focused-hub-field"]["comparable"] is False
    assert output["regressionCount"] == 0


def test_refuses_to_compare_across_a_schema_bump(tmp_path):
    directory = _write(tmp_path, "a", _report({"x": 1}, schema_version=99))

    with pytest.raises(cmp.ComparisonError, match="not comparable"):
        cmp.load_reports(directory)


def test_ignores_the_older_bare_metrics_files(tmp_path):
    """target/benchmark also holds scale-100k.json etc., which carry no envelope."""
    directory = tmp_path / "a"
    directory.mkdir()
    (directory / "scale-100k.json").write_text(json.dumps({"seed_tables": 100000}))
    (directory / "lineage-scene-scale-50000.json").write_text(json.dumps(_report({"focused-hub-asset": 900})))

    assert set(cmp.load_reports(directory)) == {"lineage-scene-scale"}


def test_errors_when_the_two_runs_share_no_benchmark(tmp_path):
    baseline = _write(tmp_path, "a", _report({"x": 1}))
    candidate = _write(tmp_path, "b", _report({"x": 1}, benchmarkId="something-else"))

    with pytest.raises(cmp.ComparisonError, match="no benchmarkId appears in both"):
        cmp.build_output(cmp.load_reports(baseline), cmp.load_reports(candidate), 25.0)


def test_errors_when_the_directory_holds_no_benchmarks(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()

    with pytest.raises(cmp.ComparisonError, match="no benchmark JSON"):
        cmp.load_reports(empty)


def test_exits_zero_on_a_regression_unless_asked_to_fail(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 1000}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 5000}))
    args = ["--baseline", str(baseline), "--candidate", str(candidate)]

    assert cmp.main(args) == 0
    assert cmp.main([*args, "--fail-on-regression"]) == 1


def test_exits_two_on_an_uninterpretable_pairing(tmp_path, capsys):
    baseline = _write(tmp_path, "a", _report({"x": 1}))
    candidate = _write(tmp_path, "b", _report({"x": 1}, benchmarkId="something-else"))

    assert cmp.main(["--baseline", str(baseline), "--candidate", str(candidate)]) == 2
    assert "error:" in capsys.readouterr().err


def test_writes_the_json_report_when_asked(tmp_path):
    baseline = _write(tmp_path, "a", _report({"focused-hub-asset": 900}))
    candidate = _write(tmp_path, "b", _report({"focused-hub-asset": 900}))
    out = tmp_path / "comparison.json"

    cmp.main(["--baseline", str(baseline), "--candidate", str(candidate), "--json-out", str(out)])

    assert json.loads(out.read_text())["comparisons"][0]["benchmarkId"] == "lineage-scene-scale"
