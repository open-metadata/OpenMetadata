package org.openmetadata.it.factories;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.search.DbCountQuerier;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.TestNamespace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Configurable entry point for provisioning the entity cohort a search/reindex IT needs. Tests call
 * {@link #provision} instead of {@link EntityLoader#load} directly so the same scenario can either
 * create its data on the fly or reuse a dataset loaded once on a shared external cluster.
 *
 * <p>The mode is chosen by {@code -Djpw.data.mode} (env fallback {@code OM_DATA_MODE}):
 *
 * <ul>
 *   <li>{@code ingest} (default) — always create the full cohort fresh, exactly as before. Roots are
 *       tracked on the namespace so {@code TestNamespaceExtension} hard-deletes them after the test.
 *   <li>{@code ensure} — create only the shortfall: for each requested kind, top up to the requested
 *       count from whatever already exists. Idempotent; the top-up is tracked for cleanup.
 *   <li>{@code static} — create nothing and track nothing. Asserts the cluster already holds at least
 *       the requested count for each countable kind so a misconfigured run fails loudly rather than
 *       passing trivially on empty indices. Pre-seed once with {@code StaticDatasetSeedIT}.
 * </ul>
 *
 * <p>{@code ensure}/{@code static} measure existing data with {@link DbCountQuerier} (DB-side
 * {@code paging.total}). Kinds it cannot count (lineage edges, time-series telemetry) are cheap
 * relative to bulk assets, so {@code ensure} always creates them and {@code static} skips them from
 * the guard. In practice the slow suites seed only {@link EntityKind#TABLE}, so the common path is
 * exact.
 */
public final class SeedData {

  private static final Logger LOG = LoggerFactory.getLogger(SeedData.class);
  private static final String MODE_PROPERTY = "jpw.data.mode";
  private static final String MODE_ENV = "OM_DATA_MODE";

  /** EntityKind → OM entity type, for the kinds {@link DbCountQuerier} can count. */
  private static final Map<EntityKind, String> COUNTABLE_TYPES = countableTypes();

  private SeedData() {}

  public enum Mode {
    INGEST,
    ENSURE,
    STATIC
  }

  public static Mode mode() {
    final String raw = lookup();
    final Mode mode;
    if (raw == null || raw.isBlank()) {
      mode = Mode.INGEST;
    } else {
      mode = Mode.valueOf(raw.trim().toUpperCase(Locale.ROOT));
    }
    return mode;
  }

  public static EntityLoadSummary provision(
      final EntityLoadSpec spec, final TestNamespace ns, final ServerHandle server) {
    final Mode mode = mode();
    LOG.info("SeedData provisioning {} entities in mode={}", spec.total(), mode);
    final EntityLoadSummary summary =
        switch (mode) {
          case INGEST -> EntityLoader.load(spec, ns);
          case ENSURE -> ensure(spec, ns, server);
          case STATIC -> useStatic(spec, server);
        };
    return summary;
  }

  private static EntityLoadSummary ensure(
      final EntityLoadSpec spec, final TestNamespace ns, final ServerHandle server) {
    final DbCountQuerier db = new DbCountQuerier(server);
    final EntityLoadSpec shortfall = shortfallSpec(spec, db);
    final EntityLoadSummary summary;
    if (shortfall.total() > 0) {
      LOG.info("SeedData ensure: creating shortfall of {} entities", shortfall.total());
      summary = EntityLoader.load(shortfall, ns);
    } else {
      LOG.info("SeedData ensure: cohort already satisfied, nothing to create");
      summary = new EntityLoadSummary.Builder().build(Duration.ZERO);
    }
    assertPresent(spec, db);
    return summary;
  }

  private static EntityLoadSummary useStatic(final EntityLoadSpec spec, final ServerHandle server) {
    final DbCountQuerier db = new DbCountQuerier(server);
    assertPresent(spec, db);
    final EntityLoadSummary.Builder summary = new EntityLoadSummary.Builder();
    for (final Map.Entry<EntityKind, Integer> requested : spec.counts().entrySet()) {
      final String type = COUNTABLE_TYPES.get(requested.getKey());
      if (type != null && db.canCount(type)) {
        summary.recordCreated(
            requested.getKey(), (int) Math.min(db.count(type), Integer.MAX_VALUE));
      }
    }
    return summary.build(Duration.ZERO);
  }

  private static EntityLoadSpec shortfallSpec(final EntityLoadSpec spec, final DbCountQuerier db) {
    final EntityLoadSpec.Builder builder = copyKnobs(spec);
    for (final Map.Entry<EntityKind, Integer> requested : spec.counts().entrySet()) {
      final EntityKind kind = requested.getKey();
      final int want = requested.getValue();
      final String type = COUNTABLE_TYPES.get(kind);
      final int existing = (type != null && db.canCount(type)) ? (int) db.count(type) : 0;
      final int missing = Math.max(0, want - existing);
      if (missing > 0) {
        builder.count(kind, missing);
      }
    }
    return builder.build();
  }

  private static void assertPresent(final EntityLoadSpec spec, final DbCountQuerier db) {
    for (final Map.Entry<EntityKind, Integer> requested : spec.counts().entrySet()) {
      final EntityKind kind = requested.getKey();
      final int want = requested.getValue();
      final String type = COUNTABLE_TYPES.get(kind);
      if (type != null && db.canCount(type)) {
        final long existing = db.count(type);
        if (existing < want) {
          throw new IllegalStateException(
              String.format(
                  "%s mode requires pre-seeded data; found %d < expected %d for %s — run "
                      + "StaticDatasetSeedIT first (or use -Djpw.data.mode=ensure)",
                  mode(), existing, want, kind));
        }
      }
    }
  }

  private static EntityLoadSpec.Builder copyKnobs(final EntityLoadSpec spec) {
    return EntityLoadSpec.builder()
        .parallelWorkers(spec.parallelWorkers())
        .columnsPerTable(spec.columnsPerTable())
        .chartsPerDashboard(spec.chartsPerDashboard())
        .endpointsPerCollection(spec.endpointsPerCollection())
        .columnsPerDataModel(spec.columnsPerDataModel())
        .testCasesPerSuite(spec.testCasesPerSuite())
        .resultsPerTestCase(spec.resultsPerTestCase());
  }

  private static Map<EntityKind, String> countableTypes() {
    final Map<EntityKind, String> map = new EnumMap<>(EntityKind.class);
    map.put(EntityKind.TABLE, "table");
    map.put(EntityKind.TOPIC, "topic");
    map.put(EntityKind.DASHBOARD, "dashboard");
    map.put(EntityKind.PIPELINE, "pipeline");
    map.put(EntityKind.ML_MODEL, "mlmodel");
    map.put(EntityKind.CONTAINER, "container");
    map.put(EntityKind.SEARCH_INDEX, "searchIndex");
    map.put(EntityKind.API_COLLECTION, "apiCollection");
    map.put(EntityKind.API_ENDPOINT, "apiEndpoint");
    map.put(EntityKind.QUERY, "query");
    map.put(EntityKind.GLOSSARY, "glossary");
    map.put(EntityKind.GLOSSARY_TERM, "glossaryTerm");
    map.put(EntityKind.CLASSIFICATION, "classification");
    map.put(EntityKind.TAG, "tag");
    map.put(EntityKind.USER, "user");
    map.put(EntityKind.TEAM, "team");
    map.put(EntityKind.DOMAIN, "domain");
    map.put(EntityKind.DATA_PRODUCT, "dataProduct");
    map.put(EntityKind.TEST_SUITE, "testSuite");
    map.put(EntityKind.TEST_CASE, "testCase");
    return Map.copyOf(map);
  }

  private static String lookup() {
    final String env = System.getenv(MODE_ENV);
    final String value;
    if (env != null && !env.isBlank()) {
      value = env;
    } else {
      value = System.getProperty(MODE_PROPERTY);
    }
    return value;
  }
}
