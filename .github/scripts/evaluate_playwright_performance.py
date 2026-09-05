#!/usr/bin/env python3
"""Evaluate Playwright shard metrics against the CI performance targets."""

from __future__ import annotations

import argparse
import glob
import json
from collections import Counter
from pathlib import Path
from typing import Any


CONVERGENCE_TARGET_NAMES = frozenset(
    {
        "commonShardSkewAtMostFifteenPercent",
        "requestsPerAttemptBelowTwoHundred",
        "atMostOneAppBootPerUIScenario",
    }
)

# Budget targets are SIGNALS, not gates. A budget breach means the pipeline
# is slower/noisier than the plan promised — someone should look at capacity,
# the timing baseline, or a runaway spec — but it must never eject a PR from
# the merge queue when every test passed. Run 32500973433 is the canonical
# counter-example this classification exists to prevent: chromium-12 finished
# all 142 tests green, one wedged retry attempt (unbounded on-failure
# trace/video teardown) pushed execution past the old blocking ceiling, and
# the PR was ejected with "0 Playwright test failure(s)". Breaches surface
# via the `Signal Playwright budget breaches` step in
# playwright-postgresql-e2e.yml (log annotations + job summary + a tracked
# GitHub issue), not via the required check.
BUDGET_TARGET_NAMES = frozenset(
    {
        "environmentAtMostFiveMinutes",
        "executionAtMostTwentyFiveMinutes",
        "shardsAtMostThirtyMinutesBeforeUpload",
        "flakyRateAtMostPointFivePercent",
        "retryWorkerTimeAtMostTwoPercent",
        "staticRequestsPerAppBootBelowOneHundred",
        "appBootMeasurementIntegrity",
    }
)


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


def has_at_most_one_app_boot_per_ui_scenario(
    app_boots: int, ui_scenarios: int
) -> bool:
    return ui_scenarios > 0 and app_boots <= ui_scenarios


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


def classify_targets(
    targets: dict[str, bool],
) -> tuple[dict[str, bool], dict[str, bool], dict[str, bool]]:
    convergence_targets = {
        name: passed
        for name, passed in targets.items()
        if name in CONVERGENCE_TARGET_NAMES
    }
    budget_targets = {
        name: passed
        for name, passed in targets.items()
        if name in BUDGET_TARGET_NAMES
    }
    # Anything neither budget nor convergence still hard-fails --enforce.
    # The set is intentionally empty today; it exists so a future target
    # that must eject PRs (e.g. corrupt results artifacts) has a home
    # without re-plumbing the workflow.
    blocking_targets = {
        name: passed
        for name, passed in targets.items()
        if name not in CONVERGENCE_TARGET_NAMES and name not in BUDGET_TARGET_NAMES
    }

    return blocking_targets, budget_targets, convergence_targets


# Human-readable label + phase-field a target reads, keyed by the target name
# used in the `targets` dict below. Used to attribute a budget breach to the
# specific shard(s) that exceeded the threshold (per the phase artifacts) so
# the breach annotation, job summary, and tracked issue are useful without
# the raw log.
BUDGET_TARGET_DETAILS: dict[str, dict[str, Any]] = {
    # TRANSITIONAL: threshold widened from 300 → 480 s while the
    # `playwright-chromium-deps-v2` apt cache is still populating across
    # branches (a cache miss triggers a real apt install that can take
    # 6-7 min on a slow Azure mirror; a cache hit is <5 s). The keeps
    # step-level `timeout` wrappers on `install-deps` in the workflow are
    # bumped in lock-step to 8 min. Tighten back to 300 s once every
    # merge_group is a cache hit — see the shard-side comment in
    # playwright-e2e-reusable.yml.
    "environmentAtMostFiveMinutes": {
        "label": "Environment setup",
        "phase_field": "environmentSeconds",
        "unit": "s",
        "threshold": 480,
    },
    # The planner packs shards to a 19-minute predicted budget
    # (COMMON_SHARD_BUDGET_MS in build_playwright_shards.py); 1500 s is that
    # promise plus tail headroom. The hang-protection `timeout … 60m` wrapper
    # in playwright-e2e-reusable.yml sits far above this on purpose: a shard
    # over 25 minutes breaches the budget (signal) but still finishes, uploads
    # results, and keeps the run green if tests passed. These two targets are
    # the "this shard is too slow" alert — they annotate the run and upsert the
    # tracked issue "Playwright CI over time budget". The wrapper is not an
    # alert and must never be used as one: killing a slow shard destroys its
    # blob report, so its tests read as never-executed and the merge-queue
    # batch is ejected with no record of what passed (2026-09-04: 584 of 4464
    # tests lost, 0 test failures, 27 batches ejected).
    "executionAtMostTwentyFiveMinutes": {
        "label": "Maximum shard execution",
        "phase_field": "executionSeconds",
        "unit": "s",
        "threshold": 1500,
    },
    "shardsAtMostThirtyMinutesBeforeUpload": {
        "label": "Maximum shard-job elapsed before upload",
        "phase_field": "elapsedBeforeUploadSeconds",
        "unit": "s",
        "threshold": 1800,
    },
}


def offending_shards(
    phases: list[dict[str, Any]], target_name: str
) -> list[dict[str, Any]]:
    detail = BUDGET_TARGET_DETAILS.get(target_name)
    if not detail:
        return []
    field = detail["phase_field"]
    threshold = detail["threshold"]
    return sorted(
        (
            {
                "shardId": str(phase.get("shardId", "unknown")),
                "lane": str(phase.get("lane", "unknown")),
                "value": int(phase.get(field, 0)),
            }
            for phase in phases
            if int(phase.get(field, 0)) > threshold
        ),
        key=lambda entry: -entry["value"],
    )


def describe_failed_target(
    name: str, phases: list[dict[str, Any]]
) -> str:
    detail = BUDGET_TARGET_DETAILS.get(name)
    shards = offending_shards(phases, name)
    if not detail or not shards:
        return name
    top = ", ".join(
        f"{shard['shardId']} {shard['value']} {detail['unit']}"
        for shard in shards[:5]
    )
    suffix = f" (+{len(shards) - 5} more)" if len(shards) > 5 else ""
    return (
        f"{name} — {detail['label']} target ≤ {detail['threshold']} "
        f"{detail['unit']}; exceeded on {len(shards)} shard(s): {top}{suffix}"
    )


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
        # Transitional 480 s ceiling — see BLOCKING_TARGET_DETAILS comment above.
        "environmentAtMostFiveMinutes": metrics["maxEnvironmentSeconds"] <= 480,
        # Aligned with the 25-minute wrapper on the shard step (`timeout … 25m`
        # in playwright-postgresql-e2e.yml, PR #30689). The previous 21-minute
        # ceiling was left over from before that wrapper bump and marked
        # otherwise-healthy shards (21-25 min execution, all tests passing) as
        # a gate failure — see run 30736786802.
        "executionAtMostTwentyFiveMinutes": metrics["maxExecutionSeconds"] <= 1500,
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
        "atMostOneAppBootPerUIScenario": has_at_most_one_app_boot_per_ui_scenario(
            app_boots, ui_scenarios
        ),
        "appBootMeasurementIntegrity": has_valid_boot_measurement(
            app_boots, ui_scenarios, app_entry_requests
        ),
    }
    blocking_targets, budget_targets, convergence_targets = classify_targets(
        targets
    )
    failed_budget_details = {
        name: {
            "label": BUDGET_TARGET_DETAILS[name]["label"],
            "threshold": BUDGET_TARGET_DETAILS[name]["threshold"],
            "unit": BUDGET_TARGET_DETAILS[name]["unit"],
            "offendingShards": offending_shards(phases, name),
        }
        for name, passed in budget_targets.items()
        if not passed and name in BUDGET_TARGET_DETAILS
    }
    output = {
        "version": 1,
        "mode": args.mode,
        "metrics": metrics,
        "targets": targets,
        "targetsMet": all(targets.values()),
        "blockingTargets": blocking_targets,
        "blockingTargetsMet": all(blocking_targets.values()),
        "budgetTargets": budget_targets,
        "budgetTargetsMet": all(budget_targets.values()),
        "convergenceTargets": convergence_targets,
        "convergenceTargetsMet": all(convergence_targets.values()),
        # Kept for downstream consumers that predate the budget/blocking
        # split (publish_playwright_pr_comment.cjs schema guard); the
        # blocking set is empty today so this is always {}.
        "failedBlockingTargetDetails": {},
        "failedBudgetTargetDetails": failed_budget_details,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    # Budget breaches never fail this script — they are surfaced by the
    # caller (log annotation + job summary + tracked issue). Print them so
    # the raw log is self-explanatory either way.
    for name, passed in budget_targets.items():
        if not passed:
            print(
                f"BUDGET BREACH: {describe_failed_target(name, phases)}",
                flush=True,
            )

    if args.enforce and not output["blockingTargetsMet"]:
        failed = "; ".join(
            describe_failed_target(name, phases)
            for name, passed in blocking_targets.items()
            if not passed
        )
        raise SystemExit(f"Blocking Playwright performance targets not met: {failed}")


if __name__ == "__main__":
    main()
