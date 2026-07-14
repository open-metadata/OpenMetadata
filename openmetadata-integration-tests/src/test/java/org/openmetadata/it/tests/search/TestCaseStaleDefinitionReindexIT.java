package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.time.Duration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchAssertions;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.service.Entity;

/**
 * Regression guard for the silent doc loss / "stats blown out" caused by a broken
 * {@code testCase→testDefinition} relationship — the demo's empty data-quality page.
 *
 * <p>When a test case's {@code testDefinition} relationship row is missing (a deleted definition or
 * data drift), the reindex must keep the test case indexable and its stats balanced. It must not
 * silently drop records that were read but never indexed or accounted for, which previously emptied
 * the data-quality page while the run reported success.
 *
 * <p>Asserts the invariant that catches the regression: every read record is accounted for by
 * success, failure, or warning counters, and the test case remains in the index without failing the
 * reindex.
 *
 * <p>Embedded-only: the relationship-row surgery needs the in-JVM DAO; the REST API would reject or
 * cascade it.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class TestCaseStaleDefinitionReindexIT {

  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();

  private static ServerHandle server;
  private static SearchAssertions search;
  private static String testCaseAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchAssertions(server);
    testCaseAlias = new IndexAliasInspector(server).indexNameFor(Entity.TEST_CASE);
    SdkClients.useFluentApis(SdkClients.adminClient());
  }

  @Test
  void brokenTestDefinitionRelationshipIsIndexedAndAccountedFor(final TestNamespace ns) {
    assumeTrue(
        !OssTestServer.isExternalMode(),
        "Deleting a single entity_relationship row (without removing the test definition) needs the "
            + "in-JVM DAO; the REST API would reject or cascade, so this case is embedded-only");

    final Table table = ShortStackFactory.table(ns);
    final TestCase broken = testCase(ns, table, "broken");
    seedResult(broken);

    Entity.getCollectionDAO()
        .relationshipDAO()
        .deleteTo(
            broken.getId(),
            Entity.TEST_CASE,
            Relationship.CONTAINS.ordinal(),
            Entity.TEST_DEFINITION);

    try {
      final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server, REINDEX_TIMEOUT);
      final Stats stats = statsOf(run);
      assertThat(run.getStatus().value()).isIn("success", "completed");
      assertThat(stats).as("run must carry stats").isNotNull();

      assertThat(sumOrZero(stats.getJobStats().getFailedRecords()))
          .as("a missing testCase->testDefinition relationship must not fail the reindex")
          .isZero();

      assertNoRecordsDropped(stats.getJobStats(), "jobStats");
      assertNoRecordsDropped(stats.getReaderStats(), "readerStats");
      search.assertEntityIndexed(testCaseAlias, Entity.TEST_CASE, broken.getFullyQualifiedName());
    } finally {
      try {
        Entity.getCollectionDAO().testCaseDAO().delete(broken.getId());
      } catch (Exception ignored) {
        // best-effort: the broken relationship can trip namespace cleanup
      }
    }
  }

  private static void assertNoRecordsDropped(final StepStats stats, final String label) {
    if (stats == null) {
      return;
    }
    final long total = sumOrZero(stats.getTotalRecords());
    final long completed =
        sumOrZero(stats.getSuccessRecords()) + sumOrZero(stats.getFailedRecords());
    final long accounted = completed + sumOrZero(stats.getWarningRecords());
    assertThat(completed)
        .as("%s success+failed must not exceed total(%d)", label, total)
        .isLessThanOrEqualTo(total);
    assertThat(accounted)
        .as(
            "%s must account for total(%d) records using success+failed plus warnings",
            label, total)
        .isGreaterThanOrEqualTo(total);
  }

  private static TestCase testCase(final TestNamespace ns, final Table table, final String name) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(ns.prefix(name))
        .description("stale-definition reindex guard")
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private static void seedResult(final TestCase testCase) {
    final CreateTestCaseResult result =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withResult("seeded result for stale-definition reindex guard");
    SdkClients.adminClient().testCaseResults().create(testCase.getFullyQualifiedName(), result);
  }

  private static Stats statsOf(final AppRunRecord run) {
    return run.getSuccessContext() == null ? null : run.getSuccessContext().getStats();
  }

  private static long sumOrZero(final Integer value) {
    return value == null ? 0L : value.longValue();
  }
}
