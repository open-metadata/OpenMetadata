package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.awaitility.Awaitility;
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

  private static final String TABLE_ALIAS = "table_search_index";
  private static final Duration OUTAGE = Duration.ofSeconds(6);
  private static final Duration DRAIN_TIMEOUT = Duration.ofMinutes(2);

  private static ServerHandle server;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void liveIndexEnqueuesRetriesDuringEsOutageAndDrainsAfter(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);

    EsOutageInjector.pauseFor(OUTAGE);

    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    final long pendingDuringOutage =
        Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING")
            + Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING_RETRY_1")
            + Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING_RETRY_2");
    assertThat(pendingDuringOutage)
        .as("at least one retry row must exist while ES is paused")
        .isGreaterThan(0);

    Awaitility.await("retry queue drains and table appears in index")
        .atMost(DRAIN_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              final long stillPending =
                  Entity.getCollectionDAO().searchIndexRetryQueueDAO().countByStatus("PENDING")
                      + Entity.getCollectionDAO()
                          .searchIndexRetryQueueDAO()
                          .countByStatus("PENDING_RETRY_1")
                      + Entity.getCollectionDAO()
                          .searchIndexRetryQueueDAO()
                          .countByStatus("PENDING_RETRY_2");
              assertThat(stillPending).as("retry queue must drain to zero pending").isZero();
              search.assertEntityIndexed(TABLE_ALIAS, "table", table.getFullyQualifiedName());
            });
  }
}
