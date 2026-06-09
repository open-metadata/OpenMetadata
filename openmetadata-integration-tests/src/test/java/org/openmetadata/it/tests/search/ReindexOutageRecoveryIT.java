package org.openmetadata.it.tests.search;

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
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.SeedData;
import org.openmetadata.it.search.EsOutageInjector;
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
 * Reindex-path counterpart to {@link LiveIndexRetryIT}. That test proves the <b>live</b> indexing
 * path (entity create/update → {@code SearchRepository}) survives a search-engine outage; this one
 * proves the <b>reindex</b> path ({@code SearchResource} → {@code SearchIndexingApplication} bulk
 * sink) recovers from one. The reported disk/OS-outage incidents (#18, #25, #26) were reindex-time —
 * OpenSearch pods/disk going unavailable mid-rebuild — so the recovery guard belongs on the bulk
 * path, not just the live path.
 *
 * <p>Seeds a cohort, confirms the reindex path indexes all of it, injects a transient engine outage,
 * then confirms a fresh reindex fully reconciles the cohort once the engine returns — i.e. an outage
 * during the rebuild window doesn't permanently wedge the reindex path or silently lose documents.
 *
 * <p>Embedded-only — it pauses the OpenSearch container, which requires the in-JVM stack.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexOutageRecoveryIT {

  private static final int SEED_TABLES = 20;
  private static final Duration OUTAGE = Duration.ofSeconds(45);
  private static final Duration REINDEX_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration RECONCILE_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration ENGINE_BACK_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(3);

  private static ServerHandle server;
  private static SearchAssertions search;
  private static String tableAlias;

  @BeforeAll
  static void setup() {
    Assumptions.assumeTrue(
        System.getenv("OM_URL") == null,
        "ReindexOutageRecoveryIT pauses the ES container (EsOutageInjector) — embedded only, "
            + "skipped in external mode");
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
  }

  @Test
  void reindexPathReconcilesAfterTransientEngineOutage(final TestNamespace ns) {
    SeedData.provision(
        EntityLoadSpec.builder().parallelWorkers(8).count(EntityKind.TABLE, SEED_TABLES).build(),
        ns,
        server);
    final String namePrefix = ns.prefix("table") + "_";

    ReindexHelpers.recreateAllAndWait(server, REINDEX_TIMEOUT);
    awaitIndexedCohort(namePrefix);

    EsOutageInjector.pauseFor(OUTAGE);
    awaitEngineResponsive();

    ReindexHelpers.recreateAllAndWait(server, REINDEX_TIMEOUT);
    awaitIndexedCohort(namePrefix);
  }

  private static void awaitIndexedCohort(final String namePrefix) {
    Awaitility.await("all " + SEED_TABLES + " seeded tables reconciled in " + tableAlias)
        .atMost(RECONCILE_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .until(() -> search.countByNamePrefix(tableAlias, namePrefix) == SEED_TABLES);
  }

  private static void awaitEngineResponsive() {
    Awaitility.await("search engine responsive again after the outage")
        .atMost(ENGINE_BACK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .until(
            () -> {
              search.count(tableAlias);
              return true;
            });
  }
}
