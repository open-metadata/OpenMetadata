/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.bench;

/**
 * A latency distribution over one benchmark scenario, in milliseconds.
 *
 * <p>Serialized verbatim into {@link BenchmarkReport#latencies()} — the field names here are the
 * published contract that {@code .github/scripts/compare_benchmark_metrics.py} diffs across runs,
 * so renaming one is a schema change (bump {@link BenchmarkMetrics#SCHEMA_VERSION}).
 */
public record Latency(
    long p50Millis,
    long p95Millis,
    long p99Millis,
    long maxMillis,
    double meanMillis,
    int sampleCount,
    int warmupCount) {}
