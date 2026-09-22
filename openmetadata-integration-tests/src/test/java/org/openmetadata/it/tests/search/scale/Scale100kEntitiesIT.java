package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
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
import org.openmetadata.it.search.DbCountQuerier;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.service.Entity;

/**
 * Scale test: reindex 100k tables under a prod-shaped JVM. Asserts the reconciliation
 * invariant ({@code db_count == es_count}), records throughput and peak CPU.
 *
 * <p>Designed for nightly runs only. Skipped from default PR suite via
 * {@code @Tag("scale")}.
 */
@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class Scale100kEntitiesIT {

  // Cohort size and reindex timeout are tunable so a CI matrix can sweep sizes (e.g. 100k, 500k)
  // to find the cluster's breaking point. Defaults preserve the original 100k / 45-minute run.
  private static final int SEED_TABLES = Integer.getInteger("jpw.scale.tables", 100_000);
  private static final int COLUMNS_PER_TABLE = 5;
  private static final int LOAD_WORKERS = 32;
  private static final Duration REINDEX_TIMEOUT =
      Duration.ofMinutes(Integer.getInteger("jpw.scale.timeoutMin", 45));

  private static ServerHandle server;
  private static SearchAssertions search;
  private static DbCountQuerier db;
  private static String tableAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    db = new DbCountQuerier(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
  }

  @Test
  void hundredThousandTableReindexReconciles(final TestNamespace ns) throws Exception {
    final long ingestStart = System.currentTimeMillis();
    SeedData.provision(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, SEED_TABLES)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .parallelWorkers(LOAD_WORKERS)
            .build(),
        ns,
        server);
    final long ingestMs = System.currentTimeMillis() - ingestStart;

    final CpuSampler cpu = new CpuSampler();
    cpu.start();
    final long reindexStart = System.currentTimeMillis();
    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server, REINDEX_TIMEOUT);
    final long reindexMs = System.currentTimeMillis() - reindexStart;
    cpu.stop();
    assertThat(run.getStatus().value()).isIn("success", "completed");

    final long dbTables = db.count("table");
    final long esTables = search.count(tableAlias);
    assertThat(esTables).as("db_count == es_count over %d tables", SEED_TABLES).isEqualTo(dbTables);

    final CpuSampler.Stats cpuStats = cpu.stats();
    final Map<String, Object> metrics = new LinkedHashMap<>();
    metrics.put("seed_tables", SEED_TABLES);
    metrics.put("ingest_ms", ingestMs);
    metrics.put("reindex_ms", reindexMs);
    metrics.put("db_count", dbTables);
    metrics.put("es_count", esTables);
    metrics.put("cpu_avg", cpuStats.avg());
    metrics.put("cpu_p95", cpuStats.p95());
    metrics.put("cpu_max", cpuStats.max());
    ReindexBenchmarkIT.writeMetrics(metrics, "scale-100k.json");
  }
}
