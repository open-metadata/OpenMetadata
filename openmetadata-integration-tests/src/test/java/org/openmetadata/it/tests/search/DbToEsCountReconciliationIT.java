package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.search.DbCountQuerier;
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
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.fluent.Apps;

/**
 * The umbrella correctness invariant: for every entity type that has both a
 * REST list endpoint and a search index alias, the post-reindex doc count in
 * the index must equal the DB count.
 *
 * <p>This is the canonical gate. If a regression breaks any indexer
 * (relationship resolution, tag join, custom property serialization,
 * vector embedding step, etc.), the reconciliation count for that entity
 * type drifts and this test fails with a per-entity-type table.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class DbToEsCountReconciliationIT {

  // testSuite/testCase are created and deleted without bound by concurrent
  // observability/data-quality
  // tests sharing this cluster (executable test suites are spawned implicitly when a test case is
  // attached to a table). A cluster-wide count of them races the reindex window — the DB can gain a
  // suite after the reindex snapshot but before the DB read — so they cannot be reconciled
  // cluster-wide on a shared cluster. Every other type is owned by stable reindex output.
  private static final Set<String> CONTENTION_PRONE_TYPES = Set.of("testSuite", "testCase");
  private static final Duration RECONCILE_POLL_INTERVAL = Duration.ofSeconds(3);

  private static ServerHandle server;
  private static IndexAliasInspector inspector;
  private static DbCountQuerier db;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    inspector = new IndexAliasInspector(server);
    db = new DbCountQuerier(server);
    search = new SearchAssertions(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void everyEntityIndexCountMatchesDbCount(final TestNamespace ns) {
    seedRepresentativeCohort(ns);

    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");

    awaitCountsReconcile();
  }

  /**
   * Polls the per-type DB↔ES counts until they reconcile. A reindex flips the run record to
   * {@code success} when the bulk writes finish, but the engine refresh that makes those docs
   * count-visible lags a beat (longer under nightly stress load), so an immediate count reads
   * {@code es < db}. The {@code search-it} profile is serial, so the DB side is quiescent — the
   * only moving part is that refresh, and the counts converge within {@link
   * ReindexHelpers#searchPropagationTimeout()}. A genuine indexer regression never converges and
   * still fails with the per-entity-type table.
   */
  private void awaitCountsReconcile() {
    Awaitility.await("entity-type DB↔ES counts reconcile after reindex")
        .atMost(ReindexHelpers.searchPropagationTimeout())
        .pollInterval(RECONCILE_POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              final List<String> mismatches = collectCountMismatches();
              assertThat(mismatches)
                  .as(
                      "entity-type counts must reconcile DB ↔ ES post-reindex:%n%s",
                      String.join("\n", mismatches))
                  .isEmpty();
            });
  }

  private List<String> collectCountMismatches() {
    final List<String> mismatches = new ArrayList<>();
    for (final String entityType : inspector.declaredEntityTypes()) {
      if (!db.canCount(entityType) || CONTENTION_PRONE_TYPES.contains(entityType)) {
        continue;
      }
      final String alias = inspector.aliasFor(entityType);
      if (inspector.indicesForAlias(alias).isEmpty()) {
        continue;
      }
      final long dbCount = db.count(entityType);
      final long esCount = search.countByEntityType(alias, entityType);
      if (dbCount != esCount) {
        mismatches.add(
            String.format(
                "  %-25s db=%d  es=%d  diff=%+d", entityType, dbCount, esCount, esCount - dbCount));
      }
    }
    return mismatches;
  }

  private static void seedRepresentativeCohort(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    TopicTestFactory.createSimple(ns);
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTermTestFactory.createSimple(ns, glossary);
  }
}
