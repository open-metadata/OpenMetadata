package org.openmetadata.playwright.scenarios.search.issues;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.Entity;

/**
 * Regression guard for the glossary-term rename corruption (fixed by PR #28725 in 1.12.11): a
 * double find-replace — the rename handler AND the reindex hook
 * each rewrote the name — turned {@code "CLV"} into {@code "CLV Renamed Renamed"} in the search doc
 * whenever the new name <b>starts with</b> the old one. The DB row stayed correct, so the only
 * visible symptom was through search: the term's page (asset list, backed by the search doc) showed
 * the wrong/duplicated name and 0 assets.
 *
 * <p>The original bug was a <i>double</i> find-replace — the rename handler (live path) AND the
 * reindex hook (bulk path) each rewrote the name — so this asserts the indexed {@code displayName}
 * equals the new value <b>exactly</b> on <b>both</b> indexing paths: first after the live update,
 * then again after a full recreate reindex (the path the reindex hook runs on).
 *
 * <p><b>Generalizes to</b>: the same rename-propagation hook drives FQN/name rewrites on
 * {@code domain}, {@code dataProduct}, {@code classification} and {@code tag} docs — see
 * {@link ClassificationRenameSearchUIIT} for the sibling on the classification index.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class GlossaryRenameSearchUIIT {

  private static final String ORIGINAL_DISPLAY_NAME = "CLV";
  // New name starts with the old one — the condition that triggered the double find-replace.
  private static final String RENAMED_DISPLAY_NAME = "CLV Renamed";

  private static final Duration PROPAGATION_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void glossaryTermPrefixRenameDoesNotDoubleApplyOnEitherIndexingPath(
      final UiSession ui, final TestNamespace ns) {
    final Glossary glossary = ns.trackRoot(Entity.GLOSSARY, GlossaryTestFactory.createSimple(ns));
    final GlossaryTerm term =
        GlossaryTermTestFactory.createWithDisplayName(ns, glossary, "clv", ORIGINAL_DISPLAY_NAME);

    final String index = new IndexAliasInspector(ui.server()).indexNameFor(Entity.GLOSSARY_TERM);
    final SearchClient search = new SearchClient(ui.server());
    final String termId = term.getId().toString();

    awaitIndexedDisplayName(search, index, termId, ORIGINAL_DISPLAY_NAME);

    term.setDisplayName(RENAMED_DISPLAY_NAME);
    SdkClients.adminClient().glossaryTerms().update(termId, term);

    // Live path: the rename handler must not double-apply.
    awaitIndexedDisplayName(search, index, termId, RENAMED_DISPLAY_NAME);

    // Reindex path: the bulk reindex hook must not re-apply the rewrite either.
    ReindexHelpers.recreateAllAndWait(ui.server(), REINDEX_TIMEOUT);
    awaitIndexedDisplayName(search, index, termId, RENAMED_DISPLAY_NAME);
  }

  private static void awaitIndexedDisplayName(
      final SearchClient search, final String index, final String id, final String expected) {
    Awaitility.await("glossaryTerm[" + id + "] displayName == '" + expected + "' in " + index)
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
    assertThat(hits.size()).as("exactly one indexed doc for term %s", id).isEqualTo(1);
    final String indexedDisplayName = hits.get(0).path("_source").path("displayName").asText();
    assertThat(indexedDisplayName)
        .as("indexed displayName must equal the new name exactly (no double find-replace)")
        .isEqualTo(expected);
  }
}
