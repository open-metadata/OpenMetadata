package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.SeedData;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.tests.search.DataQualityTableTotal;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.service.Entity;

/**
 * Regression for the Data Quality table total above the Elasticsearch cardinality precision
 * threshold (3,000). Cardinality is approximate there, so the total must come from value_count and
 * equal the live table document count exactly.
 *
 * <p>Nightly only via {@code @Tag("scale")}; seeding past 3,000 tables is too slow for the PR lane.
 */
@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
class TableTotalCountScaleIT {

  private static final int SEED_TABLES = 3_100;
  private static final int LOAD_WORKERS = 16;

  private static final String LIVE_TABLES_QUERY =
      "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

  private static ServerHandle server;
  private static SearchAssertions search;
  private static String tableAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    tableAlias = new IndexAliasInspector(server).indexNameFor(Entity.TABLE);
  }

  @Test
  void tableTotalIsExactAboveCardinalityPrecisionThreshold(TestNamespace ns) {
    SeedData.provision(
        EntityLoadSpec.builder()
            .count(EntityKind.TABLE, SEED_TABLES)
            .columnsPerTable(1)
            .parallelWorkers(LOAD_WORKERS)
            .build(),
        ns,
        server);

    Awaitility.await("seeded tables indexed")
        .atMost(Duration.ofMinutes(15))
        .pollInterval(Duration.ofSeconds(5))
        .untilAsserted(() -> assertThat(liveTableCount()).isGreaterThanOrEqualTo(SEED_TABLES));

    assertThat(
            DataQualityTableTotal.tableTotal(
                LIVE_TABLES_QUERY, DataQualityTableTotal.TABLE_TOTAL_AGGREGATION))
        .as("value_count must equal the live table document count above %d tables", SEED_TABLES)
        .isEqualTo(liveTableCount());
  }

  private static long liveTableCount() {
    return search.countMatching(tableAlias, LIVE_TABLES_QUERY);
  }
}
