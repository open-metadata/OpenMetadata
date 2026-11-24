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

import java.util.Map;

/**
 * The published envelope for one benchmark run, written to {@code target/benchmark/<name>.json} and
 * collected by the nightly as a {@code scale-metrics-*} artifact.
 *
 * <p>The envelope exists so two runs from different releases can be diffed mechanically — that is
 * the whole point of {@code openmetadata-collate#3016}. {@code schemaVersion} is what lets the
 * compare script reject a pairing it cannot interpret instead of silently reporting nonsense
 * deltas, and {@code gitSha} / {@code serverVersion} are what make a delta attributable.
 *
 * <p>{@code params} and {@code counters} are genuinely open-ended per benchmark, so they stay maps;
 * {@code latencies} is the part the compare script diffs and is typed.
 */
public record BenchmarkReport(
    int schemaVersion,
    String benchmarkId,
    String gitSha,
    String serverVersion,
    String timestampUtc,
    Map<String, Object> params,
    Map<String, Latency> latencies,
    Map<String, Object> counters) {

  public BenchmarkReport {
    params = Map.copyOf(params);
    latencies = Map.copyOf(latencies);
    counters = Map.copyOf(counters);
  }
}
