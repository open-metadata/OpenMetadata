# Nightly latency is trended on a history branch and gated against the median of recent nights

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `.github/scripts/tests/test_benchmark_trend.py` covers the gate, the baseline and the
  history layout. `ApiRoutesTest` and `ApiLatencyRecorderTest` cover route keys. A reviewer checks
  the nightly matrix order.
- **Related:** #32050, PR #34023, `open-metadata/openmetadata-nightly` `k8s-java-it.yml`,
  `docs/perf/lineage-scale-validation.md`

## Context

#32050 asks for published p95s and a build that fails on regression. A p95 from one nightly run
cannot answer either on its own:

- Runner capacity moves numbers from night to night.
- The `scale-metrics-*` artifacts expire after 30 days.
- `LineageScenePerformanceScaleIT`'s absolute budgets are placeholders, because no measurement
  existed to set them from.
- The nightly's Java suites issued thousands of API calls every night, but nothing timed them.

## Decision

1. **Every IT JVM records per-API latency.**
   - `ApiLatencyRecorder` times SDK calls through the SDK's `RequestListener` hook and browser calls
     through Playwright's request timing.
   - It keys them `"<sdk|ui> <METHOD> <normalised route>"` and keeps at most 400 routes, each in a
     fixed-size histogram with about 1% precision.
   - It publishes `target/benchmark/api-latency-<suite>.json` in the `BenchmarkReport` envelope
     (`benchmarkId` `api-latency`).
   - Each nightly job passes a stable `-Djpw.bench.suite`, because that label is the series name.
2. **A series is `benchmarkId` plus `params.suite` (API latency) or `params.tables` (lineage
   benchmark), per ref.**
3. **History lives on the `benchmark-history` branch of `openmetadata-nightly`.**
   - Layout: `runs/<ref>/<UTC timestamp>-<run id>/<series>.json` plus `run.json`.
   - The last 120 runs per ref are kept.
   - `TRENDS.md` and `charts/` are regenerated from `runs/` on every run and never edited by hand.
4. **The gate is relative.**
   - A `lineage-scene-scale` scenario regresses when its p95 exceeds the median of the previous
     7 nights' p95 by more than 25% **and** by more than 25 ms.
   - It is not judged before it has 5 nights of history, or when it has fewer than 5 samples.
   - API-latency series are reported, never gated, because their traffic changes whenever tests
     change.
   - The IT's absolute budgets stay as a backstop.
5. **`LineageScenePerformanceScaleIT` runs last in the nightly `scale-it` matrix**, after the
   destructive class, with `jpw.lineage.skipCleanup=true`.

## Consequences

- Renaming a scenario or changing route normalisation starts a new series, and history does not
  follow it. Rename deliberately.
- Renaming or removing a report field means bumping `BenchmarkMetrics.SCHEMA_VERSION`. Both scripts
  refuse versions they do not know, so a format change cannot silently break the trend.
- The script lives in OpenMetadata and the workflow and history in `openmetadata-nightly`, so the
  history layout is a cross-repository contract. Change both together.
- A relative gate does not catch a slow drift under 25% a night. The absolute budgets, tightened
  from the first week of trend data, are what catch that.
- Moving the lineage benchmark earlier in `scale-it` lets its seed and cascade slow the classes
  after it. See the matrix comments in the workflow.
