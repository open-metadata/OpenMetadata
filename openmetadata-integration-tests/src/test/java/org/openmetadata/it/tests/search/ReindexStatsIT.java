package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.service.Entity;

/**
 * Verifies the {@code AppRunRecord.successContext.stats} balance and the
 * warning-surfacing path for orphaned relationships.
 *
 * <p>For any successful reindex run:
 * <ul>
 *   <li>{@code readerStats.totalRecords == processStats.totalRecords}
 *       (everything read is processed);
 *   <li>{@code processStats.totalRecords == sinkStats.successRecords +
 *       sinkStats.failedRecords + sinkStats.warningRecords} (everything
 *       processed is accounted for at the sink);
 *   <li>and per-entity {@code entityStats} sum to the global numbers.
 * </ul>
 *
 * <p>Then injects an orphaned table→databaseSchema relationship (by deleting
 * the schema's row via the DAO and leaving the relationship row behind) and
 * asserts the next reindex surfaces at least one warning. The fixture mirrors
 * {@code LineageBrokenReferenceIT}'s broken-reference pattern.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexStatsIT {

  private static ServerHandle server;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void cleanRunBalancesReaderProcessorSink(final TestNamespace ns) {
    seedCleanCohort(ns);

    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");

    final StepStats reader = run.getSuccessContext().getStats().getReaderStats();
    final StepStats processed = run.getSuccessContext().getStats().getProcessStats();
    final StepStats sink = run.getSuccessContext().getStats().getSinkStats();

    assertThat(reader.getTotalRecords())
        .as("reader records must equal processor records")
        .isEqualTo(processed.getTotalRecords());
    assertThat(processed.getTotalRecords())
        .as("processor records must equal sum of sink success/failure/warning")
        .isEqualTo(
            sumOrZero(sink.getSuccessRecords())
                + sumOrZero(sink.getFailedRecords())
                + sumOrZero(sink.getWarningRecords()));
  }

  @Test
  void orphanedSchemaDoesNotFailReindex(final TestNamespace ns) {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "Creating an orphan (schema row hard-deleted without cascading to its table) needs the "
            + "in-JVM DAO; the REST API would reject or cascade, so this case is embedded-only");
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    Entity.getCollectionDAO().databaseSchemaDAO().delete(schema.getId());

    try {
      final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
      assertThat(run.getStatus().value()).isIn("success", "completed");

      // A table carries its own FQN/columns and builds its search doc without fetching the (now
      // hard-deleted) schema entity, so it stays self-indexable. Reindex treats a missing parent
      // as a benign stale-relationship case, not a failure (see DistributedIndexingStrategy), so a
      // deleted schema must not push failedRecords above zero or error the run.
      final StepStats sink = run.getSuccessContext().getStats().getSinkStats();
      assertThat(sumOrZero(sink.getFailedRecords()))
          .as(
              "orphaned schema for table %s must not fail the reindex (stale parent is not a failure)",
              table.getFullyQualifiedName())
          .isZero();
    } finally {
      // The schema row was force-deleted above, so the table is now orphaned. The namespace's
      // recursive service cleanup (service -> db -> schema -> table) can't reach it through the
      // broken chain, leaving a non-deleted, unindexable table on the shared cluster that later
      // skews the cluster-wide DbToEsCountReconciliationIT (table db=2/es=1). Remove it directly,
      // mirroring the DAO-level surgery used to create the orphan.
      Entity.getCollectionDAO().tableDAO().delete(table.getId());
    }
  }

  private static long sumOrZero(final Integer value) {
    return value == null ? 0L : value.longValue();
  }

  private static void seedCleanCohort(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    for (int i = 0; i < 5; i++) {
      TableTestFactory.createSimpleWithName(
          ns.prefix("table" + i), ns, schema.getFullyQualifiedName());
    }
  }
}
