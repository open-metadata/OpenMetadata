package org.openmetadata.playwright.scenarios.search.issues;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;

/**
 * Sibling of {@link GlossaryRenameSearchUIIT} for the same prefix-rename corruption class (issue
 * #33, PR #28725): the rename/FQN propagation hook is shared, so the "{@code CLV} → {@code CLV
 * Renamed Renamed}" double find-replace can recur on classification docs. The fix note explicitly
 * lists "domain/data products/classification/terms" as affected.
 *
 * <p>Renames a classification to a value prefixed by its current display name and asserts the
 * indexed {@code displayName} is the new value exactly — on <b>both</b> indexing paths: after the
 * live rename, and again after a full recreate reindex (the reindex hook that co-caused the
 * doubling).
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ClassificationRenameSearchUIIT {

  private static final String ORIGINAL_DISPLAY_NAME = "CLV";
  private static final String RENAMED_DISPLAY_NAME = "CLV Renamed";
  private static final Duration PROPAGATION_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void classificationPrefixRenameDoesNotDoubleApplyOnEitherIndexingPath(
      final UiSession ui, final TestNamespace ns) {
    final CreateClassification request =
        new CreateClassification()
            .withName(ns.prefix("clv"))
            .withDisplayName(ORIGINAL_DISPLAY_NAME)
            .withDescription("rename guard");
    final Classification classification =
        ns.trackRoot(
            Entity.CLASSIFICATION, SdkClients.adminClient().classifications().create(request));

    final String index = new IndexAliasInspector(ui.server()).indexNameFor(Entity.CLASSIFICATION);
    final SearchClient search = new SearchClient(ui.server());
    final String id = classification.getId().toString();

    awaitIndexedDisplayName(search, index, id, ORIGINAL_DISPLAY_NAME);

    classification.setDisplayName(RENAMED_DISPLAY_NAME);
    SdkClients.adminClient().classifications().update(id, classification);

    // Live path, then reindex path.
    awaitIndexedDisplayName(search, index, id, RENAMED_DISPLAY_NAME);
    ReindexHelpers.recreateAllAndWait(ui.server(), REINDEX_TIMEOUT);
    awaitIndexedDisplayName(search, index, id, RENAMED_DISPLAY_NAME);
  }

  private static void awaitIndexedDisplayName(
      final SearchClient search, final String index, final String id, final String expected) {
    Awaitility.await("classification[" + id + "] displayName == '" + expected + "'")
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(() -> assertIndexedDisplayName(search, index, id, expected));
  }

  private static void assertIndexedDisplayName(
      final SearchClient search, final String index, final String id, final String expected) {
    final String query =
        "{\"query\":{\"term\":{\"id.keyword\":\"" + id + "\"}},\"_source\":[\"displayName\"]}";
    final JsonNode hits = search.post("/" + index + "/_search", query).path("hits").path("hits");
    assertThat(hits.size()).as("exactly one indexed doc for classification %s", id).isEqualTo(1);
    final String indexed = hits.get(0).path("_source").path("displayName").asText();
    assertThat(indexed)
        .as("indexed displayName must equal the new name exactly (no double find-replace)")
        .isEqualTo(expected);
  }
}
