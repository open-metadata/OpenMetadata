package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoader;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;

/**
 * "All entities" breadth gate for the default search configuration: seeds a small cohort spanning
 * every entity kind {@link EntityLoader} produces, reindexes, and asserts each kind's per-type
 * search index holds exactly the seeded documents — i.e. the default Settings &gt; Search config
 * actually indexes and makes every entity type searchable. This is a breadth gate; exact per-type
 * DB↔ES parity is covered by {@link DbToEsCountReconciliationIT}. Any per-type drift is reported in
 * one table rather than aborting on the first kind.
 *
 * <p>Each kind is counted by the name prefix {@link EntityLoader} gives this test's entities, never
 * as a whole-index total. The cluster is shared, so a whole-index count also moves with other
 * tests' documents, for instance a previous test's deleted entities that the reindex prunes. The
 * relevancy <em>mechanics</em> (boosts, field selection, highlight, limits) are covered on a
 * representative entity by {@link SearchRelevancyPreviewIT}.
 */
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class PerEntitySearchDefaultsIT {

  private static final int PER_KIND = 2;
  private static final int INGEST_WORKERS = 8;
  private static final int COLUMNS_PER_TABLE = 2;
  private static final Duration SETTLE_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration POLL = Duration.ofSeconds(2);

  /**
   * Every kind EntityLoader can seed, paired with its search index (entity) type and the name base
   * EntityLoader prefixes its entities with.
   */
  private static final List<KindMeta> KINDS =
      List.of(
          new KindMeta(EntityKind.TABLE, "table", "table"),
          new KindMeta(EntityKind.TOPIC, "topic", "topic"),
          new KindMeta(EntityKind.DASHBOARD, "dashboard", "dashboard"),
          new KindMeta(EntityKind.PIPELINE, "pipeline", "pipeline"),
          new KindMeta(EntityKind.CHART, "chart", "chart"),
          new KindMeta(EntityKind.ML_MODEL, "mlmodel", "ml_model"),
          new KindMeta(EntityKind.CONTAINER, "container", "container"),
          new KindMeta(EntityKind.SEARCH_INDEX, "searchIndex", "search_index"),
          new KindMeta(EntityKind.API_COLLECTION, "apiCollection", "api_collection"),
          new KindMeta(EntityKind.API_ENDPOINT, "apiEndpoint", "api_endpoint"),
          new KindMeta(EntityKind.STORED_PROCEDURE, "storedProcedure", "stored_proc"),
          new KindMeta(EntityKind.QUERY, "query", "query"),
          new KindMeta(EntityKind.DASHBOARD_DATA_MODEL, "dashboardDataModel", "data_model"),
          new KindMeta(EntityKind.GLOSSARY_TERM, "glossaryTerm", "term"),
          new KindMeta(EntityKind.TAG, "tag", "tag"),
          new KindMeta(EntityKind.DOMAIN, "domain", "domain"),
          new KindMeta(EntityKind.DATA_PRODUCT, "dataProduct", "data_product"),
          new KindMeta(EntityKind.TEST_CASE, "testCase", "test_case"));

  private static ServerHandle server;
  private static IndexAliasInspector indices;
  private static SearchAssertions search;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    indices = new IndexAliasInspector(server);
    search = new SearchAssertions(server);
  }

  @Test
  void everyEntityKindIsIndexedWithDefaultSettings(final TestNamespace ns) {
    EntityLoader.load(buildCohortSpec(), ns);
    final var run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");

    final List<String> failures = new ArrayList<>();
    for (final KindMeta meta : KINDS) {
      recordIfNotIndexed(meta, ns.prefix(meta.nameBase()) + "_", failures);
    }

    assertThat(failures)
        .as(
            "every entity kind must index exactly its %d seeded docs:%n%s",
            PER_KIND, String.join("\n", failures))
        .isEmpty();
  }

  private static EntityLoadSpec buildCohortSpec() {
    final EntityLoadSpec.Builder builder =
        EntityLoadSpec.builder().parallelWorkers(INGEST_WORKERS).columnsPerTable(COLUMNS_PER_TABLE);
    for (final KindMeta meta : KINDS) {
      builder.count(meta.kind(), PER_KIND);
    }
    return builder.build();
  }

  private static void recordIfNotIndexed(
      final KindMeta meta, final String namePrefix, final List<String> failures) {
    String index = null;
    String failure = null;
    try {
      index = indices.indexNameFor(meta.type());
    } catch (final RuntimeException e) {
      failure = String.format("  %-22s no resolvable index: %s", meta.type(), e.getMessage());
    }
    if (index != null) {
      failure = awaitIndexedOrDescribe(meta, index, namePrefix);
    }
    if (failure != null) {
      failures.add(failure);
    }
  }

  private static String awaitIndexedOrDescribe(
      final KindMeta meta, final String index, final String namePrefix) {
    final AtomicLong indexed = new AtomicLong();
    String failure = null;
    try {
      Awaitility.await(meta.type() + " indexed")
          .atMost(SETTLE_TIMEOUT)
          .pollInterval(POLL)
          .pollDelay(Duration.ZERO)
          .ignoreExceptions()
          .untilAsserted(
              () -> {
                indexed.set(search.countByNamePrefix(index, namePrefix));
                assertThat(indexed.get()).isEqualTo(PER_KIND);
              });
    } catch (final ConditionTimeoutException timeout) {
      failure =
          String.format("  %-22s indexed=%d (expected %d)", meta.type(), indexed.get(), PER_KIND);
    }
    return failure;
  }

  private record KindMeta(EntityKind kind, String type, String nameBase) {}
}
