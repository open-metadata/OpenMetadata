import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "entity_api_acceptance.py"
SPEC = importlib.util.spec_from_file_location("entity_api_acceptance", SCRIPT)
acceptance = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = acceptance
SPEC.loader.exec_module(acceptance)


def measurements(values, phase="latency"):
    return [
        {
            "round": index + 1,
            "side": side,
            "p50_ms": value,
            "p95_ms": value * 2,
            "p99_ms": value * 3,
            "throughput": 1000 / value,
            "errors": 0,
            "bytes_per_operation": value * 100,
        }
        for index, pair in enumerate(values)
        for side, value in zip(("baseline", "candidate"), pair)
    ]


def test_identical_stable_builds_pass_calibration():
    result = acceptance.compare_pairs(
        measurements([(2, 2)] * 5), "calibration", "latency"
    )
    assert result["status"] == "passed"
    assert not result["candidate_acceptance"]


def test_same_build_with_drift_is_inconclusive():
    result = acceptance.compare_pairs(
        measurements([(2, 2), (2, 2), (2, 2), (2, 2), (3, 3)]),
        "calibration",
        "latency",
    )
    assert result["status"] == "inconclusive"


def test_repeated_small_regression_is_not_hidden_by_calibration_tolerances():
    result = acceptance.compare_pairs(
        measurements([(2, 2.001)] * 5), "comparison", "latency"
    )
    assert result["status"] == "regression"
    assert "p50_ms" in result["regressed_metrics"]


def test_tail_regression_cannot_hide_behind_improved_median():
    values = measurements([(2, 1.9)] * 5)
    for row in values:
        if row["side"] == "candidate":
            row["p99_ms"] = 7
    result = acceptance.compare_pairs(values, "comparison", "latency")
    assert result["status"] == "regression"
    assert "p99_ms" in result["regressed_metrics"]


def test_unstable_baseline_cannot_establish_candidate_acceptance():
    result = acceptance.compare_pairs(
        measurements([(2, 1.9), (2, 1.9), (2, 1.9), (2, 1.9), (3, 1.9)]),
        "comparison",
        "latency",
    )
    assert result["status"] == "inconclusive"
    assert not result["candidate_acceptance"]


def test_an_unexpected_error_rejects_the_comparison():
    values = measurements([(2, 1.9)] * 5)
    values[0]["errors"] = 1
    assert (
        acceptance.compare_pairs(values, "comparison", "latency")["status"] == "invalid"
    )


def test_an_unstable_candidate_is_not_accepted_because_its_median_improves():
    result = acceptance.compare_pairs(
        measurements([(2, 1), (2, 1), (2, 1), (2, 3), (2, 4)]), "comparison", "latency"
    )
    assert result["status"] == "inconclusive"


def test_overload_reports_worse_error_behavior_even_with_equal_latencies():
    values = measurements([(2, 2)] * 5)
    for row in values:
        row["errors"] = 1 if row["side"] == "baseline" else 2
    result = acceptance.compare_pairs(values, "comparison", "overload")
    assert result["status"] == "regression"
    assert "errors" in result["regressed_metrics"]


def test_allocation_compares_measured_bytes_instead_of_timing():
    values = measurements([(2, 3)] * 5)
    for row in values:
        row["bytes_per_operation"] = 100 if row["side"] == "baseline" else 90
    result = acceptance.compare_pairs(values, "comparison", "allocation")
    assert result["status"] == "passed"
    assert set(result["metrics"]) == {"bytes_per_operation"}


@pytest.mark.parametrize("mutation", ["missing", "duplicate"])
def test_exactly_five_complete_pairs_are_required(mutation):
    values = measurements([(2, 2)] * 5)
    if mutation == "missing":
        values.pop()
    else:
        values[-1] = values[0]
    with pytest.raises(ValueError, match="five complete pairs"):
        acceptance.compare_pairs(values, "comparison", "latency")


def test_summary_is_recomputed_from_all_ordered_request_samples(tmp_path):
    trace = tmp_path / "requests.csv"
    trace.write_text(
        "sequence,latency_ms,submission_delay_ms,http_status,success\n"
        + "".join(f"{index + 1},{index + 1},0,200,true\n" for index in range(2000))
    )
    result = acceptance.read_requests(trace, 2000)
    assert result["p50_ms"] == 1000
    assert result["p95_ms"] == 1900
    assert result["p99_ms"] == 1980
    with pytest.raises(ValueError, match="sample count"):
        acceptance.read_requests(trace, 2001)


def test_a_partial_matrix_never_claims_design_completion():
    missing = acceptance.missing_design_cases(
        [
            {
                "database": "mysql",
                "cache": "warm",
                "workload": "get.columns.100",
                "phase": "latency",
            }
        ]
    )
    assert ("postgres", "disabled", "create.1000", "latency") in missing
    assert ("mysql", "warm", "bulk.async.completion.3", "load50") in missing
    assert ("mysql", "warm", "get.columns.100", "latency") not in missing
