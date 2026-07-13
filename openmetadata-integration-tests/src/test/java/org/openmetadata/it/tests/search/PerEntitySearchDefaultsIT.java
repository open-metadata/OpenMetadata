package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 * search index gained at least the seeded documents — i.e. the default Settings &gt; Search config
 * actually indexes and makes every entity type searchable. Any per-type drift is reported in one
 * table rather than aborting on the first kind.
 *
 * <p>Counts are compared as a before/after <b>delta</b> on each per-type index (no fragile
 * name-prefix matching — some kinds, e.g. Query, are named by checksum). The relevancy
 * <em>mechanics</em> (boosts, field selection, highlight, limits) are covered on a representative
 * entity by {@link SearchRelevancyPreviewIT}.
 */
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class PerEntitySearchDefaultsIT {

  private static final int PER_KIND = 2;
  private static final int INGEST_WORKERS = 8;
  private static final int COLUMNS_PER_TABLE = 2;
  private static final Duration SETTLE_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration POLL = Duration.ofSeconds(2);

  /** Every kind EntityLoader can seed, paired with its search index (entity) type. */
  private static final List<KindMeta> KINDS =
      List.of(
          new KindMeta(EntityKind.TABLE, "table"),
          new KindMeta(EntityKind.TOPIC, "topic"),
          new KindMeta(EntityKind.DASHBOARD, "dashboard"),
          new KindMeta(EntityKind.PIPELINE, "pipeline"),
          new KindMeta(EntityKind.CHART, "chart"),
          new KindMeta(EntityKind.ML_MODEL, "mlmodel"),
          new KindMeta(EntityKind.CONTAINER, "container"),
          new KindMeta(EntityKind.SEARCH_INDEX, "searchIndex"),
          new KindMeta(EntityKind.API_COLLECTION, "apiCollection"),
          new KindMeta(EntityKind.API_ENDPOINT, "apiEndpoint"),
          new KindMeta(EntityKind.STORED_PROCEDURE, "storedProcedure"),
          new KindMeta(EntityKind.QUERY, "query"),
          new KindMeta(EntityKind.DASHBOARD_DATA_MODEL, "dashboardDataModel"),
          new KindMeta(EntityKind.GLOSSARY_TERM, "glossaryTerm"),
          new KindMeta(EntityKind.TAG, "tag"),
          new KindMeta(EntityKind.DOMAIN, "domain"),
          new KindMeta(EntityKind.DATA_PRODUCT, "dataProduct"),
          new KindMeta(EntityKind.TEST_CASE, "testCase"));

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
    final Map<String, Long> beforeByType = new LinkedHashMap<>();
    for (final KindMeta meta : KINDS) {
      beforeByType.put(meta.type(), safeCount(meta.type()));
    }

    EntityLoader.load(buildCohortSpec(), ns);
    final var run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");

    final List<String> failures = new ArrayList<>();
    for (final KindMeta meta : KINDS) {
      recordIfNotIndexed(meta, beforeByType.get(meta.type()), failures);
    }

    assertThat(failures)
        .as(
            "every entity kind must index at least its seeded docs:%n%s",
            String.join("\n", failures))
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
      final KindMeta meta, final long before, final List<String> failures) {
    String index = null;
    String failure = null;
    try {
      index = indices.indexNameFor(meta.type());
    } catch (final RuntimeException e) {
      failure = String.format("  %-22s no resolvable index: %s", meta.type(), e.getMessage());
    }
    if (index != null) {
      failure = awaitIndexedOrDescribe(meta, index, before);
    }
    if (failure != null) {
      failures.add(failure);
    }
  }

  private static String awaitIndexedOrDescribe(
      final KindMeta meta, final String index, final long before) {
    String failure = null;
    try {
      Awaitility.await(meta.type() + " indexed")
          .atMost(SETTLE_TIMEOUT)
          .pollInterval(POLL)
          .pollDelay(Duration.ZERO)
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertThat(search.count(index) - before).isGreaterThanOrEqualTo((long) PER_KIND));
    } catch (final ConditionTimeoutException timeout) {
      failure =
          String.format(
              "  %-22s indexed delta=%d (expected >= %d)",
              meta.type(), safeCount(meta.type()) - before, PER_KIND);
    }
    return failure;
  }

  private static long safeCount(final String type) {
    long result = 0;
    try {
      result = search.count(indices.indexNameFor(type));
    } catch (final RuntimeException ignored) {
      result = 0;
    }
    return result;
  }

  private record KindMeta(EntityKind kind, String type) {}
}
