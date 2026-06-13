package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.search.EsOutageInjector;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.service.Entity;

/**
 * Pauses the OpenSearch container so the live-index path observes write timeouts,
 * then verifies the retry pipeline:
 *
 * <ul>
 *   <li>{@code search_index_retry_queue} accumulates rows during the outage;
 *   <li>after unpause the worker drains the queue back to zero;
 *   <li>the entity created during the outage ends up indexed.
 * </ul>
 *
 * <p>Catches regressions where a SearchRepository call swallows the failure without
 * enqueuing, or the worker doesn't drain after the engine recovers.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_RETRY", mode = ResourceAccessMode.READ_WRITE)
class LiveIndexRetryIT {

  // A *paused* engine doesn't refuse writes — the live-index call blocks until the client's
  // response timeout (socketTimeoutSecs, 60s) elapses and only then fails, and the failure is
  // what enqueues a retry row. So the outage must outlast that timeout: keep the engine paused
  // well past it, poll for the retry row to appear, then resume explicitly. A short pause would
  // just block-then-succeed on resume and never enqueue anything.
  private static final Duration FAILURE_TIMEOUT = Duration.ofSeconds(120);
  private static final Duration OUTAGE_BACKSTOP = Duration.ofSeconds(180);
  private static final Duration DRAIN_TIMEOUT = Duration.ofMinutes(2);

  private static ServerHandle server;
  private static SearchAssertions search;
  private static String tableAlias;

  @BeforeAll
  static void setup() {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "LiveIndexRetryIT pauses the ES container (EsOutageInjector) and reads the retry queue via "
            + "the in-JVM DAO — both require the embedded stack, so it is skipped in external mode");
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
  }

  @Test
  void liveIndexEnqueuesRetriesDuringEsOutageAndDrainsAfter(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);

    EsOutageInjector.pauseFor(OUTAGE_BACKSTOP);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    try {
      Awaitility.await("blocked live-index write times out and enqueues a retry row")
          .atMost(FAILURE_TIMEOUT)
          .pollInterval(Duration.ofSeconds(2))
          .until(() -> pendingRetryCount() > 0);
    } finally {
      EsOutageInjector.unpause();
    }

    Awaitility.await("retry queue drains and table appears in index")
        .atMost(DRAIN_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              assertThat(pendingRetryCount()).as("retry queue must drain to zero pending").isZero();
              search.assertEntityIndexed(tableAlias, Entity.TABLE, table.getFullyQualifiedName());
            });
  }

  private static long pendingRetryCount() {
    return Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING")
        + Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING_RETRY_1")
        + Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING_RETRY_2");
  }
}
