package org.openmetadata.playwright.scenarios.search.issues;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.service.Entity;

/**
 * Regression guard for "test case status removed after 1.12.7 upgrade" (issue #30): PR #27723
 * (selective reindex fields) left {@code testCaseResult} out of
 * {@code TestCaseIndex.getRequiredReindexFields()}, so a recreate/selective reindex rebuilt every
 * TestCase doc with <b>no status</b> — the DQ dashboard showed blank statuses until a (correct)
 * reindex. The distributed path (#27876) had the same gap.
 *
 * <p>This seeds a TestCase with a result, runs a full recreate reindex (the path that dropped the
 * field), and asserts the rebuilt doc still carries {@code testCaseResult.testCaseStatus}.
 *
 * <p><b>Generalizes to</b>: any index whose {@code getRequiredReindexFields()} must include a
 * time-series/derived field the recreate path would otherwise omit — the same omission class.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class TestCaseResultReindexUIIT {

  private static final String EXPECTED_STATUS = "Failed";
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration INDEX_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(3);

  @Test
  void testCaseResultStatusSurvivesRecreateReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("tc"))
            .description("status-after-reindex guard")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    final CreateTestCaseResult result =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withResult("seeded failure for reindex guard");
    SdkClients.adminClient().testCaseResults().create(testCase.getFullyQualifiedName(), result);

    ReindexHelpers.recreateAllAndWait(ui.server(), REINDEX_TIMEOUT);

    final String index = new IndexAliasInspector(ui.server()).indexNameFor(Entity.TEST_CASE);
    awaitIndexedStatus(new SearchClient(ui.server()), index, testCase.getId().toString());
  }

  private static void awaitIndexedStatus(
      final SearchClient search, final String index, final String testCaseId) {
    Awaitility.await("testCase[" + testCaseId + "] keeps status '" + EXPECTED_STATUS + "'")
        .atMost(INDEX_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(() -> assertIndexedStatus(search, index, testCaseId));
  }

  private static void assertIndexedStatus(
      final SearchClient search, final String index, final String testCaseId) {
    final String query =
        "{\"query\":{\"term\":{\"id.keyword\":\""
            + testCaseId
            + "\"}},\"_source\":[\"testCaseResult\"]}";
    final JsonNode hits = search.post("/" + index + "/_search", query).path("hits").path("hits");
    assertThat(hits.size()).as("exactly one indexed doc for testCase %s", testCaseId).isEqualTo(1);
    final String status =
        hits.get(0).path("_source").path("testCaseResult").path("testCaseStatus").asText();
    assertThat(status)
        .as("recreate reindex must keep testCaseResult.testCaseStatus")
        .isEqualTo(EXPECTED_STATUS);
  }
}
