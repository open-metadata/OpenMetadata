#!/usr/bin/env python3
"""Evaluate Playwright shard metrics against the CI performance targets."""

from __future__ import annotations

import argparse
import glob
import json
from collections import Counter
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


def has_valid_boot_measurement(
    app_boots: int, ui_scenarios: int, app_entry_requests: int
) -> bool:
    return (
        ui_scenarios > 0
        and app_boots >= ui_scenarios
        and app_boots >= app_entry_requests
    )


def aggregate_ranked_counts(
    payloads: list[dict[str, Any]], counts_key: str, ranked_key: str, limit: int
) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()
    for payload in payloads:
        endpoint_counts = payload.get(counts_key)
        if isinstance(endpoint_counts, dict):
            counts.update(
                {
                    str(endpoint): int(requests)
                    for endpoint, requests in endpoint_counts.items()
                }
            )
            continue
        for item in payload.get(ranked_key, []):
            counts[str(item["endpoint"])] += int(item["requests"])

    return [
        {"endpoint": endpoint, "requests": count}
        for endpoint, count in counts.most_common(limit)
    ]


def main() -> None:
    args = parse_args()
    timings = load_files(args.timing_glob)
    requests = load_files(args.request_glob)
    phases = load_files(args.phase_glob)
    tests = [test for shard in timings for test in shard.get("tests", [])]
    lifecycle_tests = [
        test for shard in timings for test in shard.get("lifecycleTests", [])
    ]
    executed_tests = [test for test in tests if test.get("outcome") != "skipped"]
    executed_lifecycle_tests = [
        test for test in lifecycle_tests if test.get("outcome") != "skipped"
    ]
    executed_stability_tests = executed_tests + executed_lifecycle_tests

    attempts = sum(int(test.get("attempts", 0)) for test in executed_tests)
    lifecycle_attempts = sum(
        int(test.get("attempts", 0)) for test in executed_lifecycle_tests
    )
    stability_attempts = attempts + lifecycle_attempts
    product_worker_ms = sum(int(test.get("durationMs", 0)) for test in tests)
    lifecycle_worker_ms = sum(
        int(test.get("durationMs", 0)) for test in lifecycle_tests
    )
    total_worker_ms = product_worker_ms + lifecycle_worker_ms
    product_retry_worker_ms = sum(int(test.get("retryDurationMs", 0)) for test in tests)
    lifecycle_retry_worker_ms = sum(
        int(test.get("retryDurationMs", 0)) for test in lifecycle_tests
    )
    retry_worker_ms = product_retry_worker_ms + lifecycle_retry_worker_ms
    product_flaky_tests = sum(test.get("outcome") == "flaky" for test in tests)
    lifecycle_flaky_tests = sum(
        test.get("outcome") == "flaky" for test in lifecycle_tests
    )
    flaky_tests = product_flaky_tests + lifecycle_flaky_tests
    total_requests = sum(int(shard.get("totalRequests", 0)) for shard in requests)
    api_requests = sum(int(shard.get("apiRequests", 0)) for shard in requests)
    static_requests = sum(int(shard.get("staticRequests", 0)) for shard in requests)
    api_bytes = sum(int(shard.get("apiBytes", 0)) for shard in requests)
    static_bytes = sum(int(shard.get("staticBytes", 0)) for shard in requests)
    api_server_ms = sum(int(shard.get("apiServerMs", 0)) for shard in requests)
    static_server_ms = sum(int(shard.get("staticServerMs", 0)) for shard in requests)
    app_boots = sum(int(shard.get("appBoots", 0)) for shard in requests)
    ui_scenarios = sum(int(shard.get("uiScenarios", 0)) for shard in requests)
    app_entry_requests = sum(
        int(shard.get("appEntryRequests", 0)) for shard in requests
    )
    static_resource_types: Counter[str] = Counter()
    for shard in requests:
        static_resource_types.update(
            {
                resource_type: int(count)
                for resource_type, count in shard.get("staticResourceTypes", {}).items()
            }
        )

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
        "lifecycleTests": len(lifecycle_tests),
        "executedLifecycleTests": len(executed_lifecycle_tests),
        "lifecycleAttempts": lifecycle_attempts,
        "stabilityAttempts": stability_attempts,
        "productWorkerMs": product_worker_ms,
        "lifecycleWorkerMs": lifecycle_worker_ms,
        "totalWorkerMs": total_worker_ms,
        "productRetryWorkerMs": product_retry_worker_ms,
        "lifecycleRetryWorkerMs": lifecycle_retry_worker_ms,
        "retryWorkerMs": retry_worker_ms,
        "productFlakyTests": product_flaky_tests,
        "lifecycleFlakyTests": lifecycle_flaky_tests,
        "flakyTests": flaky_tests,
        "totalRequests": total_requests,
        "apiRequests": api_requests,
        "staticRequests": static_requests,
        "apiBytes": api_bytes,
        "staticBytes": static_bytes,
        "apiServerMs": api_server_ms,
        "staticServerMs": static_server_ms,
        "appBoots": app_boots,
        "uiScenarios": ui_scenarios,
        "appEntryRequests": app_entry_requests,
        "requestsPerAttempt": (
            round(total_requests / stability_attempts, 2)
            if stability_attempts
            else 0.0
        ),
        "staticRequestsPerAppBoot": (
            round(static_requests / app_boots, 2) if app_boots else 0.0
        ),
        "appBootsPerAttempt": (
            round(app_boots / stability_attempts, 2)
            if stability_attempts
            else 0.0
        ),
        "appBootsPerUIScenario": (
            round(app_boots / ui_scenarios, 2) if ui_scenarios else 0.0
        ),
        "staticResourceTypes": dict(sorted(static_resource_types.items())),
        "topApiEndpoints": aggregate_ranked_counts(
            requests, "apiEndpointCounts", "topApiEndpoints", 20
        ),
        "topStaticEndpoints": aggregate_ranked_counts(
            requests, "staticEndpointCounts", "topStaticEndpoints", 20
        ),
        "productFlakyRatePercent": percentage(product_flaky_tests, len(executed_tests)),
        "lifecycleFlakyRatePercent": percentage(
            lifecycle_flaky_tests, len(executed_lifecycle_tests)
        ),
        "flakyRatePercent": percentage(flaky_tests, len(executed_stability_tests)),
        "productRetryWorkerPercent": percentage(
            product_retry_worker_ms, product_worker_ms
        ),
        "lifecycleRetryWorkerPercent": percentage(
            lifecycle_retry_worker_ms, lifecycle_worker_ms
        ),
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
        "atMostOneAppBootPerUIScenario": ui_scenarios > 0
        and metrics["appBootsPerUIScenario"] <= 1,
        "appBootMeasurementIntegrity": has_valid_boot_measurement(
            app_boots, ui_scenarios, app_entry_requests
        ),
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
