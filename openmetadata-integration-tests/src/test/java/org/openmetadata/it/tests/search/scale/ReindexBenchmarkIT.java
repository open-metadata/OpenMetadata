package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.SeedData;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Reindex throughput benchmark — seeds 10k tables, runs reindex three times
 * (discarding the first as warm-up), and emits per-run metrics to
 * {@code target/benchmark/reindex-benchmark.json}.
 *
 * <p>Tagged {@code @scale} so it's excluded from PR runs; the nightly workflow
 * picks it up explicitly. CI can compare the JSON to a checked-in baseline to
 * catch regressions.
 */
@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexBenchmarkIT {

  private static final String TABLE_ALIAS = "table_search_index";
  private static final int SEED_TABLES = 10_000;
  private static final int COLUMNS_PER_TABLE = 5;
  private static final int LOAD_WORKERS = 16;
  private static final int WARMUP_RUNS = 1;
  private static final int MEASURED_RUNS = 2;

  private static ServerHandle server;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void measureReindexThroughputOverTenKCohort(final TestNamespace ns) throws Exception {
    SeedData.provision(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, SEED_TABLES)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .parallelWorkers(LOAD_WORKERS)
            .build(),
        ns,
        server);

    // Only ingest mode owns a known SEED_TABLES cohort; static/ensure reindex whatever the cluster
    // already holds (potentially 100k+), so a single measured pass is enough and 3 full rebuilds of
    // a large cluster would be needlessly slow.
    final boolean ingestMode = SeedData.mode() == SeedData.Mode.INGEST;
    final int warmupRuns = ingestMode ? WARMUP_RUNS : 0;
    final int measuredRuns = ingestMode ? MEASURED_RUNS : 1;

    long totalMs = 0;
    long totalDocs = 0;
    long peakHeap = 0;
    for (int i = 0; i < warmupRuns + measuredRuns; i++) {
      final long start = System.currentTimeMillis();
      final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
      assertThat(run.getStatus().value()).isIn("success", "completed");
      final long elapsed = System.currentTimeMillis() - start;
      final long docs = search.count(TABLE_ALIAS);
      final long heap = usedHeap();
      if (i >= warmupRuns) {
        totalMs += elapsed;
        totalDocs += docs;
        peakHeap = Math.max(peakHeap, heap);
      }
    }

    final double avgMs = totalMs / (double) measuredRuns;
    final long avgDocs = totalDocs / measuredRuns;
    final double throughput = avgDocs * 1000.0 / Math.max(1.0, avgMs);

    final Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("seed_tables", SEED_TABLES);
    metrics.put("data_mode", SeedData.mode().name());
    metrics.put("measured_runs", measuredRuns);
    metrics.put("avg_total_ms", avgMs);
    metrics.put("avg_doc_count", avgDocs);
    metrics.put("throughput_docs_per_sec", throughput);
    metrics.put("peak_heap_mb", peakHeap / (1024L * 1024L));

    writeMetrics(metrics, "reindex-benchmark.json");

    // Throughput (recorded to JSON) is the regression signal. No hard wall-clock cap: reindex time
    // is environment- and cohort-size-dependent (especially in static mode), so it flakes.
    assertThat(throughput).as("throughput must be non-zero").isGreaterThan(0);
  }

  private static long usedHeap() {
    final Runtime rt = Runtime.getRuntime();
    return rt.totalMemory() - rt.freeMemory();
  }

  static void writeMetrics(final Map<String, Object> metrics, final String filename)
      throws Exception {
    final Path dir = Path.of("target", "benchmark");
    Files.createDirectories(dir);
    new ObjectMapper()
        .writerWithDefaultPrettyPrinter()
        .writeValue(dir.resolve(filename).toFile(), metrics);
  }
}
