package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.time.Duration;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
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
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.service.Entity;

/**
 * Guard derived from the bulk-sink OOM-loop incident: a manually-persisted, aggressive bulk-sink
 * config (tiny batch + high concurrency + large payload) put gigabytes in flight and
 * deterministically OOM-looped the server (repeated restarts, HTTP 500s on every page). The
 * remediation was to stop the job and reset to safe/auto-tune values.
 *
 * <p>This triggers a reindex with an aggressive manual config and asserts the server <b>survives</b>
 * it: the run reaches a terminal state and the server stays responsive (a follow-up search and a
 * run-status fetch both succeed). A regression that lets an aggressive config crash-loop the server
 * makes the post-run assertions throw/time out.
 *
 * <p>Embedded-only: it drives the in-JVM reindex app and asserts on the in-JVM server's liveness.
 * Values are aggressive but bounded so the guard is deterministic rather than actually exhausting
 * CI heap.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class UnsafeReindexConfigIT {

  private static final int SEED_TABLES = 25;
  private static final Duration ACCEPT_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration TERMINAL_TIMEOUT = ReindexHelpers.reindexTimeout();

  private static ServerHandle server;
  private static String tableAlias;

  @BeforeAll
  static void setup() {
    Assumptions.assumeTrue(
        System.getenv("OM_URL") == null,
        "UnsafeReindexConfigIT drives the in-JVM reindex app and asserts on in-JVM server liveness — "
            + "embedded only, skipped in external mode");
    server = OssTestServer.defaultHandle();
    Apps.setDefaultClient(SdkClients.adminClient());
    tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
  }

  @Test
  void aggressiveBulkSinkConfigDoesNotTakeDownTheServer(final TestNamespace ns) {
    SeedData.provision(
        EntityLoadSpec.builder().parallelWorkers(8).count(EntityKind.TABLE, SEED_TABLES).build(),
        ns,
        server);

    final Map<String, Object> aggressiveConfig =
        Map.of(
            "recreateIndex", true,
            "batchSize", 1,
            "maxConcurrentRequests", 50,
            "consumerThreads", 5,
            "autoTune", false);
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(server, aggressiveConfig, ACCEPT_TIMEOUT);

    Awaitility.await("reindex run reaches a terminal state without crashing the server")
        .atMost(TERMINAL_TIMEOUT)
        .pollInterval(Duration.ofSeconds(3))
        .until(() -> ReindexHelpers.latestRunIsTerminal(server, ReindexHelpers.SEARCH_INDEX_APP));

    assertThat(ReindexHelpers.fetchLatestRun(server, ReindexHelpers.SEARCH_INDEX_APP))
        .as("server still serves app-run status after the aggressive-config run")
        .isNotNull();
    assertThatCode(() -> new SearchAssertions(server).count(tableAlias))
        .as("server still serves search after the aggressive-config run (no crash loop)")
        .doesNotThrowAnyException();
  }
}
