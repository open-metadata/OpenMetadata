package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.SeedData;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.service.Entity;

/**
 * Triggers a reindex over a 10k-table cohort, lets it warm up, then sends a stop
 * request and verifies:
 *
 * <ul>
 *   <li>The latest run flips to a terminal status within 30 s of the stop request;
 *   <li>The doc count in the table alias plateaus within a small window after stop
 *       (no new docs are written after stop has been accepted).
 * </ul>
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexStopUnderLoadIT {

  private static final int SEED_TABLES = 10_000;
  private static final int COLUMNS_PER_TABLE = 3;
  private static final int LOAD_WORKERS = 16;
  private static final Duration WARMUP = Duration.ofSeconds(8);
  private static final Duration STOP_TIMEOUT = Duration.ofSeconds(30);
  private static final Duration POST_STOP_QUIESCE = Duration.ofSeconds(5);

  private static ServerHandle server;
  private static SearchAssertions search;
  private static String tableAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
  }

  /**
   * Stopping a recreate mid-flight can leave indices half-dropped or aliases unswapped, and a 504
   * on the large-cohort cleanup can leak docs. Restore a clean, queryable baseline after this class
   * so neither the next search IT nor the next run on a shared cluster inherits broken state. The
   * recreate self-heals (retries until a run succeeds).
   */
  @AfterAll
  static void restoreBaseline() {
    ReindexHelpers.recreateAllAndWait(server, ReindexHelpers.reindexTimeout());
  }

  @Test
  void stopRequestTerminatesActiveReindexUnderLoad(final TestNamespace ns) throws Exception {
    SeedData.provision(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, SEED_TABLES)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .parallelWorkers(LOAD_WORKERS)
            .build(),
        ns,
        server);

    final long triggeredAt = System.currentTimeMillis();
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(
        server,
        Map.of(
            "batchSize", 50,
            "consumerThreads", 2,
            "recreateIndex", true),
        Duration.ofSeconds(20));
    ReindexHelpers.waitForRunStartedSince(
        server, ReindexHelpers.SEARCH_INDEX_APP, triggeredAt, Duration.ofSeconds(20));

    Thread.sleep(WARMUP.toMillis());

    ReindexHelpers.sendStop(server, ReindexHelpers.SEARCH_INDEX_APP);

    Awaitility.await("reindex run reaches terminal after stop")
        .atMost(STOP_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                ReindexHelpers.freshRunIsTerminal(
                    server, ReindexHelpers.SEARCH_INDEX_APP, triggeredAt));

    final AppRunRecord run = ReindexHelpers.fetchLatestRun(server, ReindexHelpers.SEARCH_INDEX_APP);
    assertThat(run.getStatus().value())
        .as("run status after stop")
        .isIn("stopped", "success", "completed");

    final long countAtStop = search.count(tableAlias);
    Thread.sleep(POST_STOP_QUIESCE.toMillis());
    final long countAfterQuiesce = search.count(tableAlias);
    assertThat(countAfterQuiesce - countAtStop)
        .as("doc count must plateau within %s after stop", POST_STOP_QUIESCE)
        .isLessThanOrEqualTo(50L);
  }
}
