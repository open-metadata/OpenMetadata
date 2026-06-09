package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

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
import org.openmetadata.it.search.CpuSampler;
import org.openmetadata.it.search.HealthProbe;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Asserts that under a 50k-table reindex, Jetty stays responsive (k8s-style health
 * probes succeed with p99 latency below 500 ms) and JVM CPU stays under a 75%
 * ceiling so the liveness probe never starves.
 *
 * <p>Captures the same metrics to {@code target/benchmark/cpu-headroom.json} for
 * regression tracking.
 */
@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexCpuHeadroomIT {

  private static final int SEED_TABLES = 50_000;
  private static final int COLUMNS_PER_TABLE = 5;
  private static final int LOAD_WORKERS = 16;
  private static final int PROBE_QPS = 10;
  private static final double CPU_P95_CEILING = 0.75;
  private static final double LATENCY_P99_CEILING_MS = 500.0;

  private static ServerHandle server;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void jettyStaysResponsiveAndCpuStaysUnderCeilingDuringReindex(final TestNamespace ns)
      throws Exception {
    SeedData.provision(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, SEED_TABLES)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .parallelWorkers(LOAD_WORKERS)
            .build(),
        ns,
        server);

    final CpuSampler cpu = new CpuSampler();
    final HealthProbe probe = new HealthProbe(server, PROBE_QPS);
    cpu.start();
    probe.start();
    try {
      final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
      assertThat(run.getStatus().value()).isIn("success", "completed");
    } finally {
      probe.stop();
      cpu.stop();
    }

    final CpuSampler.Stats cpuStats = cpu.stats();
    final HealthProbe.Stats probeStats = probe.stats();

    final Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("seed_tables", SEED_TABLES);
    metrics.put("cpu_p95", cpuStats.p95());
    metrics.put("cpu_max", cpuStats.max());
    metrics.put("probe_successes", probeStats.successes());
    metrics.put("probe_failures", probeStats.failures());
    metrics.put("probe_success_ratio", probeStats.successRatio());
    metrics.put("probe_latency_p50_ms", probeStats.latencyP50Ms());
    metrics.put("probe_latency_p99_ms", probeStats.latencyP99Ms());
    metrics.put("probe_latency_max_ms", probeStats.latencyMaxMs());
    ReindexBenchmarkIT.writeMetrics(metrics, "cpu-headroom.json");

    assertThat(cpuStats.p95())
        .as("CPU p95 must stay below k8s liveness-probe headroom")
        .isLessThanOrEqualTo(CPU_P95_CEILING);
    assertThat(probeStats.successRatio())
        .as("zero dropped health probes under reindex load")
        .isEqualTo(1.0);
    assertThat(probeStats.latencyP99Ms())
        .as("health probe p99 latency stays under k8s probe ceiling")
        .isLessThanOrEqualTo(LATENCY_P99_CEILING_MS);
  }
}
