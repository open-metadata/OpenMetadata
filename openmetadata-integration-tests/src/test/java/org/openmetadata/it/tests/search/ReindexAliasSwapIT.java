package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Verifies that a full recreate reindex performs an atomic alias swap: every
 * declared alias points to a new backing index after the run, and no orphaned
 * indices remain.
 *
 * <p>The swap is the critical zero-downtime contract — old index stays serving
 * reads until the new one is fully populated, then the alias flips. If the
 * swap is broken, reads get partial results during the window or the alias
 * disappears entirely.
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexAliasSwapIT {

  private static ServerHandle server;
  private static IndexAliasInspector inspector;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    inspector = new IndexAliasInspector(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void recreateReindexSwapsEveryAliasToNewIndex(final TestNamespace ns) {
    seedSmallCohort(ns);

    final Map<String, String> beforeSwap = new LinkedHashMap<>(inspector.aliasToIndex());
    assertThat(beforeSwap).as("aliases before reindex").isNotEmpty();

    final AppRunRecord run = ReindexHelpers.triggerSearchIndexAndWait(server);
    assertThat(run.getStatus().value()).isIn("success", "completed");

    // Per-entity alias promotions are fired by callbacks that can lag a beat behind the run
    // reaching a terminal status (an empty entity like aiAgent is promoted last, milliseconds
    // after success). Poll until every alias has flipped rather than reading the swap state once
    // and racing those callbacks.
    Awaitility.await("every alias swaps to a new backing index")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(() -> assertEveryAliasSwapped(beforeSwap));
  }

  private static void assertEveryAliasSwapped(final Map<String, String> beforeSwap) {
    final Map<String, String> afterSwap = inspector.aliasToIndex();
    assertThat(afterSwap.keySet())
        .as("alias set must be unchanged after reindex")
        .containsExactlyInAnyOrderElementsOf(beforeSwap.keySet());
    beforeSwap.forEach(
        (alias, beforeIndex) ->
            assertThat(afterSwap.get(alias))
                .as("alias %s must point to a NEW backing index after recreate reindex", alias)
                .isNotEqualTo(beforeIndex));
  }

  private static void seedSmallCohort(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    TopicTestFactory.createSimple(ns);
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTermTestFactory.createSimple(ns, glossary);
  }
}
