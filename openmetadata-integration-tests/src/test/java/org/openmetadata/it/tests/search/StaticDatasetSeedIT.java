package org.openmetadata.it.tests.search;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoadSummary;
import org.openmetadata.it.factories.EntityLoader;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.sdk.fluent.Apps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * One-time loader for the static dataset the search/reindex suites reuse when run with
 * {@code -Djpw.data.mode=static} (or {@code ensure}). Creates a bulk cohort once and leaves it on
 * the cluster: unlike the regular ITs it deliberately does <b>not</b> register
 * {@code TestNamespaceExtension}, so the entities it creates are never tracked for cleanup and
 * persist for subsequent static-mode runs.
 *
 * <p>{@code @Tag("seed")} keeps it out of the default and scale suites; run it explicitly once:
 *
 * <pre>{@code
 * mvn test -pl openmetadata-integration-tests -Dtest=StaticDatasetSeedIT -Dgroups=seed \
 *     -Djpw.scale.tables=100000   # plus OM_URL / OM_ADMIN_TOKEN for the external cluster
 * }</pre>
 *
 * Create-only — it does not trigger a reindex, since each consuming test owns its own reindex.
 */
@Tag("seed")
class StaticDatasetSeedIT {

  private static final Logger LOG = LoggerFactory.getLogger(StaticDatasetSeedIT.class);

  private static final int SEED_TABLES = Integer.getInteger("jpw.scale.tables", 100_000);
  private static final int COLUMNS_PER_TABLE = Integer.getInteger("jpw.scale.columns", 5);
  private static final int LOAD_WORKERS = Integer.getInteger("jpw.scale.workers", 32);

  @BeforeAll
  static void setup() {
    final ServerHandle server = OssTestServer.defaultHandle();
    Apps.setDefaultClient(SdkClients.adminClient());
    LOG.info("StaticDatasetSeedIT seeding against {}", server.baseUrl());
  }

  @Test
  void seedStaticTableCohort() {
    final TestNamespace ns = new TestNamespace("StaticDatasetSeed");
    ns.setMethodId("seedStaticTableCohort");
    final EntityLoadSummary summary =
        EntityLoader.load(
            EntityLoadSpec.builder()
                .count(EntityKind.TABLE, SEED_TABLES)
                .columnsPerTable(COLUMNS_PER_TABLE)
                .parallelWorkers(LOAD_WORKERS)
                .build(),
            ns);
    LOG.info(
        "StaticDatasetSeedIT done: created {} entities ({} columns) in {}",
        summary.totalEntities(),
        summary.totalColumns(),
        summary.totalDuration());
  }
}
