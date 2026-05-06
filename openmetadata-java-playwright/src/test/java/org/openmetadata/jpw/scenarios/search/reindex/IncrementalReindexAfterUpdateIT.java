package org.openmetadata.jpw.scenarios.search.reindex;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.jpw.search.ReindexHelpers;
import org.openmetadata.jpw.search.SearchAssertions;
import org.openmetadata.jpw.search.SearchClient;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.util.OssTestServer;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.Tables;

/**
 * Verifies that updating a single entity then triggering a reindex propagates the change
 * to the index. Validates the basic write-through path for incremental updates — a
 * regression net for the bulk-batch and per-entity-error fixes (#3737, #3756) that
 * could silently drop entity updates.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
@DisabledIfEnvironmentVariable(named = "JPW_MODE", matches = "external")
class IncrementalReindexAfterUpdateIT {

  private static final String TABLE_ALIAS = "table_search_index";

  private static ServerHandle server;
  private static SearchAssertions searchAssertions;
  private static SearchClient searchClient;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    searchAssertions = new SearchAssertions(server);
    searchClient = new SearchClient(server);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void descriptionUpdateIsReflectedInIndex(final TestNamespace ns) {
    final Table table = seedTable(ns);
    ReindexHelpers.triggerSearchIndexAndWait(server);
    searchAssertions.assertEntityIndexed(TABLE_ALIAS, "table", table.getFullyQualifiedName());

    final String newDescription = "Updated description for " + ns.prefix("table");
    Tables.update(table.getId().toString(), table.withDescription(newDescription));

    ReindexHelpers.triggerSearchIndexAndWait(server);

    final String indexedDescription = fetchIndexedDescription(table.getFullyQualifiedName());
    assertThat(indexedDescription)
        .as("Indexed description should reflect the post-reindex update")
        .isEqualTo(newDescription);
  }

  private Table seedTable(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private String fetchIndexedDescription(final String fqn) {
    final String body =
        "{\"size\":1,\"query\":{\"term\":{\"fullyQualifiedName.keyword\":\""
            + fqn.replace("\"", "\\\"")
            + "\"}}}";
    final JsonNode response = searchClient.post("/" + TABLE_ALIAS + "/_search", body);
    final JsonNode hit = response.path("hits").path("hits").path(0).path("_source");
    return hit.path("description").asText();
  }
}
