package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoader;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Verifies that during an active recreate reindex the table alias always:
 * <ul>
 *   <li>resolves to some backing index (no read-side gap);
 *   <li>contains no duplicate {@code _id}s (no id is indexed in two documents at once);
 *   <li>does not drop below the pre-reindex doc count (no visible window
 *       where docs are missing).
 * </ul>
 *
 * <p>The pre-reindex baseline gives us "the read-side never goes blank"; the exact
 * duplicate-id check gives us "no double-indexing while two backing indices coexist."
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class NoDuplicatesDuringReindexIT {

  private static final Logger LOG = LoggerFactory.getLogger(NoDuplicatesDuringReindexIT.class);
  private static final int SEED_TABLES = 2_000;
  private static final int COLUMNS_PER_TABLE = 3;
  private static final int PARALLEL_LOAD_WORKERS = 8;
  private static final Duration PROBE_DURATION = Duration.ofSeconds(40);
  private static final Duration PROBE_INTERVAL = Duration.ofMillis(500);

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

  @Test
  void aliasIsAlwaysReadableAndDeduplicatedDuringReindex(final TestNamespace ns) throws Exception {
    EntityLoader.load(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, SEED_TABLES)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .parallelWorkers(PARALLEL_LOAD_WORKERS)
            .build(),
        ns);

    ReindexHelpers.triggerSearchIndexAndWait(server);
    final long baseline = search.count(tableAlias);
    assertThat(baseline).as("baseline doc count after pre-warm reindex").isGreaterThan(0);

    final ExecutorService probeExecutor = Executors.newSingleThreadExecutor();
    final ExecutorService reindexExecutor = Executors.newSingleThreadExecutor();
    final List<ProbeResult> samples = new ArrayList<>();

    try {
      final long deadline = System.currentTimeMillis() + PROBE_DURATION.toMillis();
      final Future<AppRunRecord> reindexFuture =
          reindexExecutor.submit(() -> ReindexHelpers.triggerSearchIndexAndWait(server));
      final Future<?> probeFuture =
          probeExecutor.submit(
              () -> {
                while (System.currentTimeMillis() < deadline) {
                  samples.add(probeOnce());
                  try {
                    Thread.sleep(PROBE_INTERVAL.toMillis());
                  } catch (final InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                  }
                }
              });

      probeFuture.get(PROBE_DURATION.toSeconds() + 10, TimeUnit.SECONDS);
      final AppRunRecord run = reindexFuture.get(PROBE_DURATION.toSeconds() + 60, TimeUnit.SECONDS);
      assertThat(run.getStatus().value()).isIn("success", "completed");
    } finally {
      probeExecutor.shutdownNow();
      reindexExecutor.shutdownNow();
    }

    LOG.info("collected {} probe samples", samples.size());
    assertThat(samples).as("must collect probe samples").isNotEmpty();
    for (final ProbeResult sample : samples) {
      assertThat(sample.count)
          .as(
              "alias %s must always resolve to a non-empty index (probe @ %d ms)",
              tableAlias, sample.atMillis)
          .isGreaterThan(0);
      assertThat(sample.hasDuplicates)
          .as(
              "no duplicate _ids in alias %s at probe %d ms (count=%d)",
              tableAlias, sample.atMillis, sample.count)
          .isFalse();
    }

    final long finalCount = search.count(tableAlias);
    assertThat(search.hasDuplicateIds(tableAlias))
        .as("no duplicate _ids in alias %s after reindex", tableAlias)
        .isFalse();
    assertThat(finalCount)
        .as("final doc count must not drop below pre-reindex baseline")
        .isGreaterThanOrEqualTo(baseline);
  }

  private ProbeResult probeOnce() {
    final long count = search.count(tableAlias);
    final boolean hasDuplicates = search.hasDuplicateIds(tableAlias);
    return new ProbeResult(System.currentTimeMillis(), count, hasDuplicates);
  }

  private record ProbeResult(long atMillis, long count, boolean hasDuplicates) {}
}
