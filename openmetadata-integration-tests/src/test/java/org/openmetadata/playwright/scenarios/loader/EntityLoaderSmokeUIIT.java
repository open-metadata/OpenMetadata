package org.openmetadata.playwright.scenarios.loader;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
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
 * Smoke check for {@link EntityLoader}'s parallel ingest path. Two layers of coverage:
 *
 * <ol>
 *   <li>{@link #loaderCreatesRequestedEntitiesInParallel} — original 4-kind cohort that
 *       still backs scale-test pre-flight checks; tight runtime expectation.
 *   <li>{@link #loaderHandlesEveryKindAtSmokeScale} — minimum non-zero count for every
 *       {@link EntityKind} the loader implements, so any broken kind fails fast at
 *       PR time instead of after 40+ min into a scale=40 stress run (which is how
 *       {@code QUERY} initially shipped with a missing service field).
 * </ol>
 *
 * <p>No browser involved — this lives under {@code *UIIT} only because that's the failsafe
 * execution that boots the containerized server and skips the embedded TestSuiteBootstrap.
 *
 * <p>Asserts the {@link EntityLoadSummary} returned by the loader matches what was
 * requested. Doesn't query OM separately — bookkeeping correctness is what we're proving
 * here; deeper count verification belongs to the search-index tests that do it via ES.
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

  // All-kinds smoke: minimum count per kind that proves the loader path works without
  // burning real load. Asset kinds get 3; time-series rows get 5 to make the rate
  // visible in logs; lineage gets 5 so the mixed-ratio split has something to fan out.
  private static final int ALL_KINDS_ASSET_COUNT = 3;
  private static final int ALL_KINDS_TS_COUNT = 5;
  private static final int ALL_KINDS_LINEAGE_COUNT = 5;

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
    // Don't assert on wall-clock — it flakes on shared/loaded runners. Log it instead.
    LOG.info("4-kind cohort load duration: {}", summary.totalDuration());
  }

  /**
   * Exercises every {@link EntityKind} the loader implements at minimum-N so a broken
   * loader (missing required field, wrong endpoint, prereq chain gap) fails the smoke
   * suite instead of a 40-min scale stress run. Asserts each kind's reported count.
   */
  @Test
  void loaderHandlesEveryKindAtSmokeScale(final TestNamespace ns) {
    UiTestServer.get();

    final Map<EntityKind, Integer> expected = buildExpectedCounts();

    final EntityLoadSpec.Builder builder =
        EntityLoadSpec.builder()
            .parallelWorkers(PARALLEL_WORKERS)
            .columnsPerTable(COLUMNS_PER_TABLE);
    expected.forEach(builder::count);
    final EntityLoadSpec spec = builder.build();

    final EntityLoadSummary summary = EntityLoader.load(spec, ns);
    LOG.info("All-kinds smoke loader summary: {}", summary);

    expected.forEach(
        (kind, count) ->
            assertThat(summary.countOf(kind))
                .as(
                    "loader for %s should report the requested count; if zero, the kind's"
                        + " create call probably threw and was wrapped as 'Failed to load %s'",
                    kind, kind)
                .isEqualTo(count));

    final int expectedTotal = expected.values().stream().mapToInt(Integer::intValue).sum();
    assertThat(summary.totalEntities()).isEqualTo(expectedTotal);
    // Don't assert on wall-clock — it flakes on shared/loaded runners. Log it instead.
    LOG.info("All-kinds smoke load duration: {}", summary.totalDuration());
  }

  private static Map<EntityKind, Integer> buildExpectedCounts() {
    final Map<EntityKind, Integer> expected = new LinkedHashMap<>();
    // Asset entities (each has its own search index)
    for (EntityKind kind :
        new EntityKind[] {
          EntityKind.TABLE,
          EntityKind.TOPIC,
          EntityKind.DASHBOARD,
          EntityKind.CHART,
          EntityKind.DASHBOARD_DATA_MODEL,
          EntityKind.PIPELINE,
          EntityKind.ML_MODEL,
          EntityKind.CONTAINER,
          EntityKind.SEARCH_INDEX,
          EntityKind.API_COLLECTION,
          EntityKind.API_ENDPOINT,
          EntityKind.STORED_PROCEDURE,
          EntityKind.QUERY,
          // Taxonomy
          EntityKind.GLOSSARY,
          EntityKind.GLOSSARY_TERM,
          EntityKind.CLASSIFICATION,
          EntityKind.TAG,
          // Org
          EntityKind.USER,
          EntityKind.TEAM,
          // Governance
          EntityKind.DOMAIN,
          EntityKind.DATA_PRODUCT,
          // Quality
          EntityKind.TEST_SUITE,
          EntityKind.TEST_CASE
        }) {
      expected.put(kind, ALL_KINDS_ASSET_COUNT);
    }
    // Graph — set after assets so TABLE/DASHBOARD/PIPELINE collected sets are populated
    expected.put(EntityKind.LINEAGE_EDGE, ALL_KINDS_LINEAGE_COUNT);
    // Time-series telemetry (perf-test.sh phase 7)
    for (EntityKind kind :
        new EntityKind[] {
          EntityKind.TEST_CASE_RESULT,
          EntityKind.ENTITY_REPORT_DATA,
          EntityKind.WEB_ANALYTIC_VIEW,
          EntityKind.WEB_ANALYTIC_ACTIVITY,
          EntityKind.RAW_COST_ANALYSIS,
          EntityKind.AGG_COST_ANALYSIS
        }) {
      expected.put(kind, ALL_KINDS_TS_COUNT);
    }
    return expected;
  }
}
