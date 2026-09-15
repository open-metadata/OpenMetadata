#!/usr/bin/env python3
"""Evaluate complete paired API traces; incomplete or unstable evidence cannot pass."""

import argparse
import csv
import hashlib
import itertools
import json
import math
import statistics
import sys
from pathlib import Path

SIDES = ("baseline", "candidate")
PERCENTILES = {"p50_ms": 0.50, "p95_ms": 0.95, "p99_ms": 0.99}
MAX_SPREAD = {"p50_ms": 1.10, "p95_ms": 1.15, "p99_ms": 1.20}
MAX_BIAS = {"p50_ms": 1.03, "p95_ms": 1.05, "p99_ms": 1.10}
PHASES = ("latency", "allocation", "load25", "load50", "load75", "overload", "recovery")
CACHES = ("disabled", "warm", "cold", "l1-cold", "unavailable", "recovered")


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def reference(path):
    return {"path": str(Path(path).resolve()), "sha256": sha256(path)}


def verified_path(entry, directory):
    path = (directory / entry["path"]).resolve()
    if sha256(path) != entry["sha256"]:
        raise ValueError(f"Input hash differs: {path}")
    return path


def verified_json(entry, directory):
    return json.loads(verified_path(entry, directory).read_text())


def positive(value):
    value = float(value)
    if not math.isfinite(value) or value <= 0:
        raise ValueError("Expected a finite positive measurement")
    return value


def read_requests(path, samples):
    with path.open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != samples or samples < 2000:
        raise ValueError("Insufficient or inconsistent measured sample count")
    if [int(row["sequence"]) for row in rows] != list(range(1, samples + 1)):
        raise ValueError("Request sequence is incomplete or duplicated")
    if any(row["success"] not in ("true", "false") for row in rows):
        raise ValueError("Unknown request outcome")
    durations = sorted(positive(row["latency_ms"]) for row in rows)
    delays = [float(row["submission_delay_ms"]) for row in rows]
    if any(not math.isfinite(delay) or delay < 0 for delay in delays):
        raise ValueError("Invalid submission delay")
    return {
        **{
            key: durations[math.ceil(samples * quantile) - 1]
            for key, quantile in PERCENTILES.items()
        },
        "errors": sum(row["success"] != "true" for row in rows),
        "submission_delay_p99_ms": sorted(delays)[math.ceil(samples * 0.99) - 1],
    }


def compare_pairs(rows, kind, phase):
    coordinates = {(row["round"], row["side"]) for row in rows}
    if len(rows) != 10 or coordinates != set(itertools.product(range(1, 6), SIDES)):
        raise ValueError("Exactly five complete pairs are required")
    if kind not in ("calibration", "comparison") or phase not in PHASES:
        raise ValueError("Unknown experiment kind or phase")
    by_pair = {(row["round"], row["side"]): row for row in rows}
    metrics = (
        ("bytes_per_operation",)
        if phase == "allocation"
        else (*PERCENTILES, "throughput")
    )
    summaries = {}
    regressed = []
    stable = True
    for metric in metrics:
        left = [positive(by_pair[index, "baseline"][metric]) for index in range(1, 6)]
        right = [positive(by_pair[index, "candidate"][metric]) for index in range(1, 6)]
        ratios = [candidate / baseline for baseline, candidate in zip(left, right)]
        median = statistics.median(ratios)
        values = left + right if kind == "calibration" else left
        spread = max(values) / min(values)
        if kind == "comparison":
            spread = max(spread, max(right) / min(right))
        repeatable = spread <= MAX_SPREAD.get(metric, 1.10)
        if kind == "calibration":
            repeatable &= max(median, 1 / median) <= MAX_BIAS.get(metric, 1.03)
        stable &= repeatable
        worse = (
            all(ratio < 1 for ratio in ratios)
            if metric == "throughput"
            else all(ratio > 1 for ratio in ratios)
        )
        if worse:
            regressed.append(metric)
        summaries[metric] = {
            "ratios": ratios,
            "median_ratio": median,
            "spread": spread,
            "repeatable": repeatable,
        }
    overload = phase == "overload"
    error_totals = {
        side: sum(row["errors"] for row in rows if row["side"] == side)
        for side in SIDES
    }
    if overload and error_totals["candidate"] > error_totals["baseline"]:
        if kind == "comparison":
            regressed.append("errors")
        else:
            stable = False
    if not overload and any(row["errors"] for row in rows):
        status = "invalid"
    elif not stable:
        status = "inconclusive"
    elif kind == "comparison" and regressed:
        status = "regression"
    else:
        status = "passed"
    return {
        "status": status,
        "candidate_acceptance": kind == "comparison" and status == "passed",
        "metrics": summaries,
        "regressed_metrics": regressed if kind == "comparison" else [],
        "error_totals": error_totals,
    }


def required_workloads():
    prefixes = [
        "get.columns",
        "get.metrics",
        "get.extensions",
        "get.relationships",
        "list.metrics",
        "get.history",
        "put.unchanged",
        "put.changed",
        "patch.description",
        "patch.column",
        "create",
        "bulk.create",
        "bulk.duplicate",
        "bulk.unchanged",
        "bulk.changed",
        "bulk.mixed",
        "bulk.async.accepted",
        "bulk.async.completion",
        "delete.soft",
        "delete.hard",
        "restore",
        "patch.conflict",
        "csv.export",
        "csv.import.unchanged",
        "csv.import.changed",
        "csv.import.dry_run",
    ]
    prefixes += [
        f"get.{principal}{fields}.{lookup}"
        for principal, fields, lookup in itertools.product(
            ("", "reader."), ("minimal", "expanded"), ("id", "name")
        )
    ]
    prefixes += [
        f"columns.page.{projection}.{principal}.{lookup}"
        for projection, principal, lookup in itertools.product(
            ("basic", "metadata", "profile"), ("admin", "reader"), ("id", "name")
        )
    ]
    prefixes += [
        "list.keyset.small",
        "list.keyset.large",
        "list.offset.small",
        "list.offset.large",
        "history.keyset.small",
        "history.keyset.large",
        "put.consolidated",
        "bulk.metadata_override",
        "delete.tree",
        "restore.tree",
        "concurrent.read_write",
    ]
    return [
        f"{prefix}.{width}"
        for prefix, width in itertools.product(prefixes, (3, 100, 1000))
    ]


def case_key(case):
    return tuple(case[key] for key in ("database", "cache", "workload", "phase"))


def missing_design_cases(cases):
    required = set(
        itertools.product(("mysql", "postgres"), CACHES, required_workloads(), PHASES)
    )
    return sorted(required - {case_key(case) for case in cases})


def validate_case(case):
    positive(case["offered_rps"])
    if case["database"] not in ("mysql", "postgres") or case["cache"] not in CACHES:
        raise ValueError("Unknown database or cache state")
    if case["phase"] not in PHASES or case["workload"] not in required_workloads():
        raise ValueError("Unknown phase or workload")
    single = case["phase"] in ("latency", "allocation")
    expected = "single-client" if single else "open-loop"
    if case["scheduling"] != expected:
        raise ValueError(
            "Latency/allocation use single-client; offered-load phases use open-loop"
        )
    if not single:
        capacity = positive(case["baseline_capacity_rps"])
        fraction = {
            "load25": 0.25,
            "load50": 0.50,
            "load75": 0.75,
            "overload": 1.25,
            "recovery": 0.50,
        }[case["phase"]]
        if not math.isclose(
            positive(case["offered_rps"]), capacity * fraction, rel_tol=1e-6
        ):
            raise ValueError("Offered load must use the recorded baseline capacity")
        if (
            case["cache"] in ("cold", "l1-cold")
            and case.get("cache_lifecycle") != "cold-start"
        ):
            raise ValueError(
                "Serial per-request resets cannot establish concurrent cold-cache load"
            )


def read_run(entry, plan, directory):
    samples = plan["samples"]
    if not plan.get("analysis_only", False):
        if len(entry["cache_states"]) != 2:
            raise ValueError("Record cache state before and after each window")
        for state_file in entry["cache_states"]:
            state = verified_json(state_file, directory)
            cache = plan["case"]["cache"]
            if state["configured"] != (cache != "disabled") or (
                state["configured"] and state["available"] != (cache != "unavailable")
            ):
                raise ValueError(
                    "Cache availability differs from the declared workload"
                )
    if plan["case"].get("cache_lifecycle") == "cold-start":
        reset = verified_json(entry["cache_reset"], directory)
        if (
            reset["lifecycle"] != "cold-start"
            or reset["reset"] != plan["case"]["cache"]
            or reset["acknowledgedAt"] <= 0
        ):
            raise ValueError("Concurrent cold-start reset is unproven")
    trace = read_requests(verified_path(entry["requests"], directory), samples)
    with verified_path(entry["summary"], directory).open(newline="") as stream:
        matching = [
            row
            for row in csv.DictReader(stream)
            if row["workload"] == plan["case"]["workload"]
        ]
    if len(matching) != 1:
        raise ValueError("Missing or duplicated workload summary")
    summary = matching[0]
    if int(summary["samples"]) != samples or int(summary["errors"]) != trace["errors"]:
        raise ValueError("Summary disagrees with request outcomes")
    for metric in PERCENTILES:
        if not math.isclose(
            float(summary[metric]), trace[metric], rel_tol=1e-6, abs_tol=1e-6
        ):
            raise ValueError("Summary disagrees with measured request percentiles")
    expected_scheduling = plan["case"]["scheduling"]
    if (
        plan["case"]["cache"] in ("cold", "l1-cold")
        and plan["case"].get("cache_lifecycle") != "cold-start"
    ):
        expected_scheduling = "acknowledged-reset-serial"
    if summary["scheduling"] != expected_scheduling:
        raise ValueError("Measured scheduling differs from the declared case")
    expected_reset = (
        plan["case"]["cache"]
        if expected_scheduling == "acknowledged-reset-serial"
        else "none"
    )
    if summary["reset"] != expected_reset:
        raise ValueError("Measured cache reset differs from the declared case")
    if expected_scheduling == "open-loop" and not math.isclose(
        float(summary["offered_rps"]), plan["case"]["offered_rps"], abs_tol=0.00051
    ):
        raise ValueError("Baseline/candidate offered loads differ")
    exit_code = int(verified_path(entry["exit"], directory).read_text())
    expected_exit = (
        1
        if trace["errors"] and plan["case"]["phase"] in ("overload", "capacity")
        else 0
    )
    if exit_code != expected_exit:
        raise ValueError("Benchmark process failed")
    trace.update(
        round=entry["round"],
        side=entry["side"],
        throughput=(samples - trace["errors"]) / positive(summary["elapsed_seconds"]),
    )
    if plan["case"]["phase"] == "allocation":
        allocation = verified_json(entry["allocation"], directory)
        delta = (
            allocation["after"]["allocatedBytes"]
            - allocation["before"]["allocatedBytes"]
        )
        if (
            allocation["operations"] != samples
            or allocation["before"]["allocatedBytes"] < 0
            or delta < 0
            or delta != allocation["allocatedBytes"]
        ):
            raise ValueError("Invalid allocation observation window")
        if not math.isclose(allocation["bytesPerOperation"], delta / samples):
            raise ValueError(
                "Allocation per operation disagrees with the counter delta"
            )
        trace["bytes_per_operation"] = allocation["bytesPerOperation"]
    return trace


def evaluate_capacity(manifest, directory):
    plan = verified_json(manifest["plan"], directory)
    if (
        plan["kind"] != "capacity"
        or plan.get("instrumented", True)
        or plan["case"]["phase"] != "latency"
    ):
        raise ValueError("Expected uninstrumented baseline capacity probes")
    if (
        plan["warmup"] < 1000
        or plan["conditioning"] < plan["samples"]
        or not 0 < plan["max_submission_delay_ms"] <= 100
    ):
        raise ValueError("Capacity warmup or queue-delay bound is invalid")
    calibration_path = verified_path(manifest["calibration"], directory)
    calibration_manifest = json.loads(calibration_path.read_text())
    if (
        verified_json(calibration_manifest["plan"], calibration_path.parent)["kind"]
        != "calibration"
    ):
        raise ValueError("Capacity requires a baseline calibration")
    calibration = evaluate(calibration_manifest, calibration_path.parent)
    if calibration["status"] != "passed" or any(
        calibration[key] != plan[key]
        for key in ("case", "baseline_sha256", "client_sha256", "runner_sha256")
    ):
        raise ValueError("Capacity requires a passing calibration with matching inputs")
    groups = {}
    for entry in manifest["runs"]:
        rate = positive(entry["offered_rps"])
        probe_plan = {
            **plan,
            "case": {
                **plan["case"],
                "phase": "capacity",
                "scheduling": "open-loop",
                "offered_rps": rate,
            },
        }
        row = read_run(entry, probe_plan, directory)
        if row["side"] != "baseline":
            raise ValueError("Capacity must be measured on the baseline")
        groups.setdefault(rate, []).append(row)
    if set(groups) != set(plan["rates"]) or len(groups) < 2:
        raise ValueError("Capacity ramp is incomplete")
    qualified = []
    for rate, rows in groups.items():
        if len(rows) != 5 or {row["round"] for row in rows} != set(range(1, 6)):
            raise ValueError("Capacity needs five complete observations at each rate")
        if all(
            row["errors"] == 0
            and row["throughput"] >= rate * 0.99
            and row["submission_delay_p99_ms"] <= plan["max_submission_delay_ms"]
            for row in rows
        ):
            qualified.append(rate)
    bracketed = qualified and max(qualified) < max(groups)
    return {
        "status": "passed" if bracketed else "inconclusive",
        "baseline_capacity_rps": max(qualified) if qualified else None,
        "definition": "Highest offered rate meeting 99% throughput and the predeclared queue-delay bound in all five observations; a higher rate must fail",
        **{
            key: plan[key]
            for key in ("case", "baseline_sha256", "client_sha256", "runner_sha256")
        },
    }


def evaluate(manifest, directory):
    plan = verified_json(manifest["plan"], directory)
    validate_case(plan["case"])
    if (
        plan["samples"] < 2000
        or plan["warmup"] < 1000
        or plan["conditioning"] < plan["samples"]
    ):
        raise ValueError("Insufficient tail samples or JVM conditioning/warmup")
    if plan.get("instrumented", True):
        raise ValueError("Instrumented runs cannot establish latency acceptance")
    if (
        plan["kind"] == "calibration"
        and plan["baseline_sha256"] != plan["candidate_sha256"]
    ):
        raise ValueError("Calibration must compare the same artifact")
    order = [
        side for index in range(1, 6) for side in (SIDES if index % 2 else SIDES[::-1])
    ]
    if [row["side"] for row in manifest["runs"]] != order:
        raise ValueError("Baseline/candidate order must alternate across five pairs")
    rows = [read_run(entry, plan, directory) for entry in manifest["runs"]]
    result = compare_pairs(rows, plan["kind"], plan["case"]["phase"])
    if plan.get("analysis_only", False):
        result.update(
            status="inconclusive", candidate_acceptance=False, analysis_only=True
        )
    if plan["case"]["phase"] == "recovery":
        overload_plan = {
            **plan,
            "case": {
                **plan["case"],
                "phase": "overload",
                "offered_rps": plan["case"]["baseline_capacity_rps"] * 1.25,
            },
        }
        overload_rows = [
            read_run(entry["overload"], overload_plan, directory)
            for entry in manifest["runs"]
        ]
        overload = compare_pairs(overload_rows, plan["kind"], "overload")
        result["overload"] = overload
        if overload["status"] != "passed":
            result.update(status=overload["status"], candidate_acceptance=False)
    if plan["case"]["phase"] not in ("latency", "allocation"):
        capacity_path = verified_path(manifest["capacity"], directory)
        capacity = evaluate_capacity(
            json.loads(capacity_path.read_text()), capacity_path.parent
        )
        identity = ("baseline_sha256", "client_sha256", "runner_sha256")
        scenario = ("database", "cache", "workload")
        if (
            capacity["status"] != "passed"
            or capacity["baseline_capacity_rps"]
            != plan["case"]["baseline_capacity_rps"]
            or any(capacity[key] != plan[key] for key in identity)
            or any(capacity["case"][key] != plan["case"][key] for key in scenario)
        ):
            raise ValueError(
                "Load comparison lacks matching baseline capacity evidence"
            )
    if plan["kind"] == "comparison":
        calibration_path = verified_path(manifest["calibration"], directory)
        calibration_manifest = json.loads(calibration_path.read_text())
        calibration_plan = verified_json(
            calibration_manifest["plan"], calibration_path.parent
        )
        if calibration_plan["kind"] != "calibration":
            raise ValueError(
                "A comparison requires a baseline-versus-baseline calibration"
            )
        calibration = evaluate(calibration_manifest, calibration_path.parent)
        same_runner = (
            calibration["runner_sha256"] == plan["runner_sha256"]
            and calibration["client_sha256"] == plan["client_sha256"]
        )
        same_case = calibration["case"] == plan["case"]
        if (
            calibration["status"] != "passed"
            or not same_runner
            or not same_case
            or calibration["baseline_sha256"] != plan["baseline_sha256"]
        ):
            result.update(
                status="inconclusive",
                candidate_acceptance=False,
                calibration_passed=False,
            )
    result.update(
        case=plan["case"],
        kind=plan["kind"],
        runner_sha256=plan["runner_sha256"],
        client_sha256=plan["client_sha256"],
        baseline_sha256=plan["baseline_sha256"],
        candidate_sha256=plan["candidate_sha256"],
        plan_sha256=manifest["plan"]["sha256"],
    )
    return result


def evaluate_matrix(manifest, directory):
    reports = []
    for entry in manifest["experiments"]:
        path = verified_path(entry, directory)
        reports.append(evaluate(json.loads(path.read_text()), path.parent))
    passing = [
        report["case"]
        for report in reports
        if report["kind"] == "comparison" and report["status"] == "passed"
    ]
    for key in ("baseline_sha256", "candidate_sha256", "client_sha256"):
        if len({report[key] for report in reports}) > 1:
            raise ValueError(
                "A matrix cannot combine different artifact/client revisions"
            )
    keys = [case_key(report["case"]) for report in reports]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate experiments cannot fill matrix gaps")
    missing = missing_design_cases(passing)
    return {
        "status": "incomplete" if missing else "passed",
        "passed_cases": len(passing),
        "missing_cases": missing,
        "scope": "HTTP latency, offered load, recovery and allocation; SQL/commit diagnostics and coverage are separate gates",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        manifest = json.loads(args.manifest.read_text())
        evaluator = {"matrix": evaluate_matrix, "capacity": evaluate_capacity}.get(
            manifest.get("kind"), evaluate
        )
        result = evaluator(manifest, args.manifest.parent)
        result["manifest_sha256"] = sha256(args.manifest)
        with args.output.open("x") as stream:
            json.dump(result, stream, indent=2)
            stream.write("\n")
        print(result["status"])
        return 0 if result["status"] == "passed" else 1
    except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
        print(f"Invalid acceptance evidence: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
