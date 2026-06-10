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
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

/**
 * Regression guard for the "pipeline owners missing from index" issue (fix #28109/#28264):
 * pipelines were indexed with {@code owners: []} even when they had an owner, so the {@code isOwner()}
 * RBAC policy denied everyone access through search/landing pages. The DB had the owner; only the
 * search doc's owner enrichment was dropped.
 *
 * <p>This creates a pipeline with an explicit owner and asserts the indexed doc carries that owner
 * in its {@code owners} array — the field {@code isOwner()} reads.
 *
 * <p><b>Generalizes to</b>: owner enrichment is shared ({@code SearchIndex.populateCommonFields}), so
 * a regression drops owners from every entity's doc; the reported incident was on
 * {@code ingestion_pipeline_search_index}, and the same guard belongs on any owned entity type.
 */
// READ lock: this asserts a live-indexed doc is present, so it must not run concurrently with a
// sibling's recreate reindex (READ_WRITE) — an alias swap mid-flight drops the freshly-indexed doc
// and the assertion sees 0 hits. READ holders still run in parallel with each other.
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ)
class PipelineOwnerIndexUIIT {

  private static final Duration INDEX_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void ownedPipelineCarriesOwnerInSearchDoc(final UiSession ui, final TestNamespace ns) {
    final User owner = UserTestFactory.createUser(ns, "pipeline_owner");
    final PipelineService service =
        ns.trackRoot(Entity.PIPELINE_SERVICE, PipelineServiceTestFactory.createAirflow(ns));

    final CreatePipeline request =
        new CreatePipeline()
            .withName(ns.prefix("owned_pipeline"))
            .withService(service.getFullyQualifiedName())
            .withOwners(List.of(owner.getEntityReference().withType(Entity.USER)));
    final Pipeline pipeline = SdkClients.adminClient().pipelines().create(request);

    final String index = new IndexAliasInspector(ui.server()).indexNameFor(Entity.PIPELINE);
    final SearchClient search = new SearchClient(ui.server());
    awaitOwnerIndexed(search, index, pipeline.getId().toString(), owner.getId().toString());
  }

  private static void awaitOwnerIndexed(
      final SearchClient search,
      final String index,
      final String pipelineId,
      final String ownerId) {
    Awaitility.await("pipeline[" + pipelineId + "] indexed with owner " + ownerId)
        .atMost(INDEX_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(() -> assertOwnerIndexed(search, index, pipelineId, ownerId));
  }

  private static void assertOwnerIndexed(
      final SearchClient search,
      final String index,
      final String pipelineId,
      final String ownerId) {
    final String query =
        "{\"query\":{\"term\":{\"id.keyword\":\"" + pipelineId + "\"}},\"_source\":[\"owners\"]}";
    final JsonNode hits = search.post("/" + index + "/_search", query).path("hits").path("hits");
    assertThat(hits.size()).as("exactly one indexed doc for pipeline %s", pipelineId).isEqualTo(1);
    final JsonNode owners = hits.get(0).path("_source").path("owners");
    assertThat(owners.isArray() && !owners.isEmpty())
        .as("indexed pipeline must carry its owner (isOwner relies on owners[])")
        .isTrue();
    boolean ownerPresent = false;
    for (final JsonNode owner : owners) {
      ownerPresent = ownerPresent || ownerId.equals(owner.path("id").asText());
    }
    assertThat(ownerPresent).as("owners[] must contain owner id %s", ownerId).isTrue();
  }
}
