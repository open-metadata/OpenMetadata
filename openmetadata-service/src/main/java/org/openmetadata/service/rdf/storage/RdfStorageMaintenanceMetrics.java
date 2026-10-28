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
package org.openmetadata.service.rdf.storage;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

/**
 * Logs and measures RDF storage maintenance. A compaction that does not succeed leaves the store
 * growing until the disk fills, so every outcome other than success is logged as an error and
 * every run is timed by outcome; the last-success gauge is what an alert should watch.
 */
@Slf4j
public final class RdfStorageMaintenanceMetrics {
  static final String METRIC_MAINTENANCE = "rdf.storage.maintenance";
  static final String METRIC_LAST_SUCCESS = "rdf.storage.maintenance.last.success";
  private static final String COMPACT = "compact";
  private static final Map<String, AtomicLong> LAST_SUCCESS = new ConcurrentHashMap<>();

  private RdfStorageMaintenanceMetrics() {}

  public static void recordCompaction(final String dataset, final CompactionResult result) {
    Metrics.timer(
            METRIC_MAINTENANCE,
            "operation",
            COMPACT,
            "dataset",
            dataset,
            "outcome",
            result.outcome().name().toLowerCase(Locale.ROOT))
        .record(result.elapsed());
    if (result.succeeded()) {
      lastSuccess(dataset).set(System.currentTimeMillis());
      LOG.info("Compacted RDF dataset '{}' in {} ms", dataset, result.elapsed().toMillis());
    } else if (result.outcome() != CompactionResult.Outcome.UNSUPPORTED) {
      LOG.error(
          "Compaction of RDF dataset '{}' did not succeed ({}, task {}, after {} ms): {}",
          dataset,
          result.outcome(),
          result.taskId(),
          result.elapsed().toMillis(),
          result.detail());
    }
  }

  private static AtomicLong lastSuccess(final String dataset) {
    return LAST_SUCCESS.computeIfAbsent(
        dataset,
        name -> {
          final AtomicLong value = new AtomicLong();
          Gauge.builder(METRIC_LAST_SUCCESS, value, AtomicLong::get)
              .tag("dataset", name)
              .description("Epoch millis of the last successful compaction")
              .register(Metrics.globalRegistry);
          return value;
        });
  }
}
