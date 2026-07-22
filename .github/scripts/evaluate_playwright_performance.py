#!/usr/bin/env python3
"""Evaluate Playwright shard metrics against the CI performance targets."""

from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timing-glob", required=True)
    parser.add_argument("--request-glob", required=True)
    parser.add_argument("--phase-glob", required=True)
    parser.add_argument("--mode", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--enforce", action="store_true")
    return parser.parse_args()


def load_files(pattern: str) -> list[dict[str, Any]]:
    return [
        json.loads(Path(filename).read_text(encoding="utf-8"))
        for filename in sorted(glob.glob(pattern, recursive=True))
    ]


def percentage(numerator: float, denominator: float) -> float:
    return round(100 * numerator / denominator, 2) if denominator else 0.0


def main() -> None:
    args = parse_args()
    timings = load_files(args.timing_glob)
    requests = load_files(args.request_glob)
    phases = load_files(args.phase_glob)
    tests = [test for shard in timings for test in shard.get("tests", [])]
    executed_tests = [test for test in tests if test.get("outcome") != "skipped"]

    attempts = sum(int(test.get("attempts", 0)) for test in executed_tests)
    total_worker_ms = sum(int(test.get("durationMs", 0)) for test in tests)
    retry_worker_ms = sum(int(test.get("retryDurationMs", 0)) for test in tests)
    flaky_tests = sum(test.get("outcome") == "flaky" for test in tests)
    total_requests = sum(int(shard.get("totalRequests", 0)) for shard in requests)
    static_requests = sum(int(shard.get("staticRequests", 0)) for shard in requests)
    api_bytes = sum(int(shard.get("apiBytes", 0)) for shard in requests)
    static_bytes = sum(int(shard.get("staticBytes", 0)) for shard in requests)
    api_server_ms = sum(int(shard.get("apiServerMs", 0)) for shard in requests)
    static_server_ms = sum(int(shard.get("staticServerMs", 0)) for shard in requests)
    app_boots = sum(int(shard.get("appBoots", 0)) for shard in requests)

    chromium_seconds = sorted(
        int(phase.get("executionSeconds", 0))
        for phase in phases
        if phase.get("lane") == "chromium"
    )
    skew_percent = (
        percentage(chromium_seconds[-1] - chromium_seconds[0], chromium_seconds[-1])
        if len(chromium_seconds) > 1 and chromium_seconds[-1]
        else 0.0
    )

    metrics = {
        "tests": len(tests),
        "executedTests": len(executed_tests),
        "attempts": attempts,
        "totalRequests": total_requests,
        "apiBytes": api_bytes,
        "staticBytes": static_bytes,
        "apiServerMs": api_server_ms,
        "staticServerMs": static_server_ms,
        "requestsPerAttempt": round(total_requests / attempts, 2) if attempts else 0.0,
        "staticRequestsPerAppBoot": (
            round(static_requests / app_boots, 2) if app_boots else 0.0
        ),
        "appBootsPerAttempt": round(app_boots / attempts, 2) if attempts else 0.0,
        "flakyRatePercent": percentage(flaky_tests, len(executed_tests)),
        "retryWorkerPercent": percentage(retry_worker_ms, total_worker_ms),
        "commonShardSkewPercent": skew_percent,
        "maxEnvironmentSeconds": max(
            (int(phase.get("environmentSeconds", 0)) for phase in phases), default=0
        ),
        "maxExecutionSeconds": max(
            (int(phase.get("executionSeconds", 0)) for phase in phases), default=0
        ),
        "maxElapsedBeforeUploadSeconds": max(
            (int(phase.get("elapsedBeforeUploadSeconds", 0)) for phase in phases),
            default=0,
        ),
    }
    targets = {
        "environmentAtMostFiveMinutes": metrics["maxEnvironmentSeconds"] <= 300,
        "executionAtMostTwentyOneMinutes": metrics["maxExecutionSeconds"] <= 1260,
        "shardsAtMostThirtyMinutesBeforeUpload": metrics[
            "maxElapsedBeforeUploadSeconds"
        ]
        <= 1800,
        "commonShardSkewAtMostFifteenPercent": skew_percent <= 15,
        "flakyRateAtMostPointFivePercent": metrics["flakyRatePercent"] <= 0.5,
        "retryWorkerTimeAtMostTwoPercent": metrics["retryWorkerPercent"] <= 2,
        "requestsPerAttemptBelowTwoHundred": metrics["requestsPerAttempt"] < 200,
        "staticRequestsPerAppBootBelowOneHundred": app_boots > 0
        and metrics["staticRequestsPerAppBoot"] < 100,
        "atMostOneAppBootPerAttempt": metrics["appBootsPerAttempt"] <= 1,
    }
    output = {
        "version": 1,
        "mode": args.mode,
        "metrics": metrics,
        "targets": targets,
        "targetsMet": all(targets.values()),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    if args.enforce and not output["targetsMet"]:
        failed = ", ".join(name for name, passed in targets.items() if not passed)
        raise SystemExit(f"Playwright performance targets not met: {failed}")


if __name__ == "__main__":
    main()
