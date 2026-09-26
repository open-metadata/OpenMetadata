#!/usr/bin/env python3
"""Diff two lineage benchmark runs and report the per-scenario p95 delta.

The nightly scale job uploads `openmetadata-integration-tests/target/benchmark` as a
`scale-metrics-*` artifact. Point this at two downloaded artifacts — typically one per
release, since the nightly's `imageTag` input lets a run deploy an older published build —
and it produces the table a release-over-release comparison is written from.

    ./compare_benchmark_metrics.py --baseline ./run-1.13 --candidate ./run-2.0

Regression detection is a SIGNAL by default, matching evaluate_playwright_performance.py:
`--fail-on-regression PCT` has to be passed explicitly for a non-zero exit. Benchmark
numbers move with runner capacity, and a comparison across two different nightly runs is
not a controlled experiment; treat a flagged scenario as something to reproduce, not as
proof on its own.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Bumped by BenchmarkMetrics.SCHEMA_VERSION whenever a published field is renamed or
# removed. Comparing across a bump would silently diff fields that no longer mean the same
# thing, so we refuse instead.
SUPPORTED_SCHEMA_VERSIONS = frozenset({1})

# The metric the comparison is about. p50 is also published and is the better read when a
# run has too few samples for the tail to mean anything.
COMPARED_METRIC = "p95Millis"

UNCHANGED_LABEL = "="
IMPROVED_LABEL = "faster"
REGRESSED_LABEL = "SLOWER"

# Absolute floor below which a percentage says nothing. A warm cached root scene lands in
# single-digit milliseconds, where 1ms -> 3ms is +200% and means nothing at all.
NOISE_FLOOR_MS = 5


class ComparisonError(RuntimeError):
    """A pairing that cannot be interpreted, as opposed to one that looks slow."""


def load_reports(path: Path) -> dict[str, dict[str, Any]]:
    """Loads every benchmark report under `path`, keyed by benchmarkId."""
    files = sorted(path.glob("*.json")) if path.is_dir() else [path]
    if not files:
        raise ComparisonError(f"no benchmark JSON found under {path}")
    reports: dict[str, dict[str, Any]] = {}
    for file in files:
        report = json.loads(file.read_text())
        if "benchmarkId" not in report or "latencies" not in report:
            # target/benchmark also holds the older bare-metrics files (scale-100k.json and
            # friends), which have no envelope. Skip rather than fail the whole comparison.
            continue
        _require_supported_schema(report, file)
        reports[report["benchmarkId"]] = report
    if not reports:
        raise ComparisonError(f"no enveloped benchmark reports under {path}")
    return reports


def _require_supported_schema(report: dict[str, Any], file: Path) -> None:
    version = report.get("schemaVersion")
    if version not in SUPPORTED_SCHEMA_VERSIONS:
        raise ComparisonError(
            f"{file}: schemaVersion {version!r} is not comparable "
            f"(this script understands {sorted(SUPPORTED_SCHEMA_VERSIONS)})"
        )


def compare_scenarios(
    baseline: dict[str, Any], candidate: dict[str, Any], tolerance_pct: float
) -> list[dict[str, Any]]:
    """Pairs scenarios present in both reports and computes the percentage change."""
    baseline_latencies = baseline.get("latencies", {})
    candidate_latencies = candidate.get("latencies", {})
    rows = []
    for scenario in sorted(set(baseline_latencies) | set(candidate_latencies)):
        before = baseline_latencies.get(scenario, {}).get(COMPARED_METRIC)
        after = candidate_latencies.get(scenario, {}).get(COMPARED_METRIC)
        rows.append(_row(scenario, before, after, tolerance_pct))
    return rows


def _row(scenario: str, before: int | None, after: int | None, tolerance_pct: float) -> dict[str, Any]:
    return {
        "scenario": scenario,
        "baselineMillis": before,
        "candidateMillis": after,
        "changePct": _percent_change(before, after),
        "verdict": _verdict(before, after, tolerance_pct),
        "comparable": before is not None and after is not None,
    }


def _percent_change(before: int | None, after: int | None) -> float | None:
    """None when there is no meaningful ratio — a missing side, or a zero baseline."""
    if before is None or after is None or before == 0:
        return None
    return (after - before) / before * 100.0


def _verdict(before: int | None, after: int | None, tolerance_pct: float) -> str:
    if before is None or after is None:
        return "n/a"
    # A warm cached scene can round to 0-2ms, where a percentage is all noise and a ratio
    # against a zero baseline is undefined. Below the floor, call it unchanged.
    if abs(after - before) <= NOISE_FLOOR_MS:
        return UNCHANGED_LABEL
    if before == 0:
        return REGRESSED_LABEL
    change = _percent_change(before, after)
    if change > tolerance_pct:
        return REGRESSED_LABEL
    if change < -tolerance_pct:
        return IMPROVED_LABEL
    return UNCHANGED_LABEL


def regressions(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if row["verdict"] == REGRESSED_LABEL]


def render_markdown(baseline: dict[str, Any], candidate: dict[str, Any], rows: list[dict[str, Any]]) -> str:
    lines = [
        f"### Lineage benchmark: `{baseline['benchmarkId']}`",
        "",
        "| | version | commit | assets | edges |",
        "|---|---|---|---|---|",
        f"| baseline | {_describe(baseline)}",
        f"| candidate | {_describe(candidate)}",
        "",
        "| scenario | baseline p95 | candidate p95 | change | |",
        "|---|---:|---:|---:|---|",
    ]
    lines.extend(
        f"| `{row['scenario']}` | {_ms(row['baselineMillis'])} | "
        f"{_ms(row['candidateMillis'])} | {_pct(row['changePct'])} | {row['verdict']} |"
        for row in rows
    )
    return "\n".join(lines)


def _describe(report: dict[str, Any]) -> str:
    params = report.get("params", {})
    return (
        f"{report.get('serverVersion', 'unknown')} | "
        f"`{str(report.get('gitSha', 'unknown'))[:12]}` | "
        f"{params.get('tables', '?')} | {params.get('edges', '?')} |"
    )


def _ms(value: int | None) -> str:
    return "—" if value is None else f"{value} ms"


def _pct(change: float | None) -> str:
    return "—" if change is None else f"{change:+.1f}%"


def build_output(
    baseline_reports: dict[str, dict[str, Any]],
    candidate_reports: dict[str, dict[str, Any]],
    tolerance_pct: float,
) -> dict[str, Any]:
    shared = sorted(set(baseline_reports) & set(candidate_reports))
    if not shared:
        raise ComparisonError(
            "no benchmarkId appears in both runs "
            f"(baseline: {sorted(baseline_reports)}, candidate: {sorted(candidate_reports)})"
        )
    comparisons = []
    for benchmark_id in shared:
        baseline = baseline_reports[benchmark_id]
        candidate = candidate_reports[benchmark_id]
        rows = compare_scenarios(baseline, candidate, tolerance_pct)
        comparisons.append(
            {
                "benchmarkId": benchmark_id,
                "baseline": _identity(baseline),
                "candidate": _identity(candidate),
                "scenarios": rows,
                "regressions": [row["scenario"] for row in regressions(rows)],
                "markdown": render_markdown(baseline, candidate, rows),
            }
        )
    return {
        "tolerancePct": tolerance_pct,
        "comparisons": comparisons,
        "regressionCount": sum(len(c["regressions"]) for c in comparisons),
    }


def _identity(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "serverVersion": report.get("serverVersion"),
        "gitSha": report.get("gitSha"),
        "timestampUtc": report.get("timestampUtc"),
        "params": report.get("params", {}),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path, help="earlier run's benchmark dir")
    parser.add_argument("--candidate", required=True, type=Path, help="later run's benchmark dir")
    parser.add_argument(
        "--tolerance-pct",
        type=float,
        default=25.0,
        help="percentage growth in p95 before a scenario is called a regression",
    )
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="exit non-zero when any scenario regressed (off by default: this is a signal)",
    )
    parser.add_argument("--json-out", type=Path, help="write the full comparison here")
    args = parser.parse_args(argv)

    try:
        output = build_output(load_reports(args.baseline), load_reports(args.candidate), args.tolerance_pct)
    except ComparisonError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    for comparison in output["comparisons"]:
        print(comparison["markdown"])
        print()
    if args.json_out:
        args.json_out.write_text(json.dumps(output, indent=2))
    if output["regressionCount"]:
        print(
            f"{output['regressionCount']} scenario(s) exceeded +{args.tolerance_pct}%",
            file=sys.stderr,
        )
    return 1 if (args.fail_on_regression and output["regressionCount"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
