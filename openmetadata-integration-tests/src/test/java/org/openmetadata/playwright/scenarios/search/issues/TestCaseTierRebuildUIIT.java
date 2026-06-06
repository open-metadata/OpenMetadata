package org.openmetadata.playwright.scenarios.search.issues;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
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
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.service.Entity;

/**
 * Regression guard for the Tags/Tier regression from PR #26947 (issue #32): the shared
 * {@code TaggableIndex}/{@code ParseTags} path stripped {@code Tier} out of {@code tags[]} on a full
 * rebuild. Live updates kept the old shape, so the DQ nested-tag query only broke <b>after a
 * recreate reindex</b> — the fix overrode {@code applyTagFields()} on {@code TestCaseIndex}.
 *
 * <p>This tags a TestCase with {@code Tier.Tier1}, runs a full recreate reindex (the path that
 * stripped Tier), and asserts the rebuilt doc still carries the tier.
 *
 * <p><b>Generalizes to</b>: every {@code TaggableIndex} entity (≈35 indexes) shares the
 * tier/tag-derivation logic; a regression strips Tier from all of them on recreate.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class TestCaseTierRebuildUIIT {

  private static final String TIER_FQN = "Tier.Tier1";
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration INDEX_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(3);

  @Test
  void testCaseTierSurvivesRecreateReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("tc"))
            .description("tier-after-rebuild guard")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    final TagLabel tier =
        new TagLabel()
            .withTagFQN(TIER_FQN)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    testCase.setTags(List.of(tier));
    SdkClients.adminClient().testCases().update(testCase.getId().toString(), testCase);

    ReindexHelpers.recreateAllAndWait(ui.server(), REINDEX_TIMEOUT);

    final String index = new IndexAliasInspector(ui.server()).indexNameFor(Entity.TEST_CASE);
    awaitIndexedTier(new SearchClient(ui.server()), index, testCase.getId().toString());
  }

  private static void awaitIndexedTier(
      final SearchClient search, final String index, final String testCaseId) {
    Awaitility.await("testCase[" + testCaseId + "] keeps tier '" + TIER_FQN + "' after rebuild")
        .atMost(INDEX_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(() -> assertIndexedTier(search, index, testCaseId));
  }

  private static void assertIndexedTier(
      final SearchClient search, final String index, final String testCaseId) {
    final String query =
        "{\"query\":{\"term\":{\"id.keyword\":\"" + testCaseId + "\"}},\"_source\":[\"tier\"]}";
    final JsonNode hits = search.post("/" + index + "/_search", query).path("hits").path("hits");
    assertThat(hits.size()).as("exactly one indexed doc for testCase %s", testCaseId).isEqualTo(1);
    final String tierFqn = hits.get(0).path("_source").path("tier").path("tagFQN").asText();
    assertThat(tierFqn)
        .as("recreate reindex must not strip Tier from the TestCase doc")
        .isEqualTo(TIER_FQN);
  }
}
