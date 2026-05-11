package org.openmetadata.it.scenarios.loader;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoadSummary;
import org.openmetadata.it.factories.EntityLoader;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Smoke check for {@link EntityLoader}'s parallel ingest path. Boots the standard UI test
 * server (containerized OM) and ingests a small batch of mixed entity kinds so the
 * full-scale {@code SearchIndexVariousFlowsUIIT} can rely on the loader working before
 * spending minutes on 10k+ entities.
 *
 * <p>No browser involved — this lives under {@code *UIIT} only because that's the failsafe
 * execution that boots the containerized server and skips the embedded TestSuiteBootstrap.
 *
 * <p>Asserts the {@link EntityLoadSummary} returned by the loader matches what was
 * requested. Doesn't query OM separately — bookkeeping correctness is what we're proving
 * here; deeper count verification belongs to the search-index test that does it via ES.
 */
@ExtendWith(TestNamespaceExtension.class)
class EntityLoaderSmokeUIIT {

  private static final Logger LOG = LoggerFactory.getLogger(EntityLoaderSmokeUIIT.class);

  // Small batch — designed to finish in < 60s on a healthy stack so this runs every PR.
  private static final int TABLES = 50;
  private static final int TOPICS = 50;
  private static final int DASHBOARDS = 50;
  private static final int PIPELINES = 50;
  private static final int COLUMNS_PER_TABLE = 5;
  private static final int PARALLEL_WORKERS = 8;

  @Test
  void loaderCreatesRequestedEntitiesInParallel(final TestNamespace ns) {
    UiTestServer.get();

    EntityLoadSpec spec =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE)
            .count(EntityKind.TABLE, TABLES)
            .count(EntityKind.TOPIC, TOPICS)
            .count(EntityKind.DASHBOARD, DASHBOARDS)
            .count(EntityKind.PIPELINE, PIPELINES)
            .build();

    EntityLoadSummary summary = EntityLoader.load(spec, ns);
    LOG.info("Loader summary: {}", summary);

    assertThat(summary.countOf(EntityKind.TABLE)).isEqualTo(TABLES);
    assertThat(summary.countOf(EntityKind.TOPIC)).isEqualTo(TOPICS);
    assertThat(summary.countOf(EntityKind.DASHBOARD)).isEqualTo(DASHBOARDS);
    assertThat(summary.countOf(EntityKind.PIPELINE)).isEqualTo(PIPELINES);
    assertThat(summary.totalEntities()).isEqualTo(TABLES + TOPICS + DASHBOARDS + PIPELINES);
    assertThat(summary.totalColumns()).isEqualTo(TABLES * COLUMNS_PER_TABLE);
    assertThat(summary.totalDuration()).isLessThan(Duration.ofMinutes(2));
  }
}
