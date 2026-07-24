/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * Search-index read-your-write contract: a write commits the DB transaction, applies the sync cache
 * write-through, then indexes the entity in Elasticsearch synchronously post-commit before the
 * request returns. An entity is therefore searchable as soon as its create/update returns — there is
 * no eventual-consistency window for search.
 *
 * <ul>
 *   <li><b>Read-your-write</b>: GET /entity/&#123;id&#125; (DB + sync cache) is immediately
 *       consistent after create/update.
 *   <li><b>Search read-your-write</b>: the document is searchable immediately after the write
 *       returns (polled with Awaitility only to stay robust to Elasticsearch's own refresh latency).
 *   <li><b>Same-entity ordering</b>: a create immediately followed by an update is reflected in
 *       search as the FINAL value (never the stale create-time value, never a 404).
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AsyncSearchIndexConsistencyIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE_SEARCH_INDEX = "table_search_index";
  private static final Duration SEARCH_AT_MOST = Duration.ofSeconds(60);
  private static final Duration SEARCH_POLL = Duration.ofMillis(500);

  @Test
  void writeReturnsImmediatelyThenBecomesSearchable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "async_visible", "first description");
    String tableId = table.getId().toString();

    Table byId = client.tables().get(tableId, "");
    assertNotNull(byId, "GET by id must be immediately consistent (DB + sync cache)");
    assertEquals(table.getId(), byId.getId());

    // Search indexing runs synchronously post-commit, so the entity is searchable as soon as the
    // write returns. We still poll with Awaitility to stay robust to Elasticsearch's own refresh
    // latency rather than asserting on the very first sample.
    awaitSearchHit(client, table.getFullyQualifiedName(), tableId);
  }

  @Test
  void sameEntityCreateThenUpdateConvergesToFinalValueInSearch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "async_ordering", "stale description");

    String finalDescription = "FINAL description " + ns.shortPrefix();
    table.setDescription(finalDescription);
    Table updated = client.tables().update(table.getId().toString(), table);
    assertEquals(finalDescription, updated.getDescription(), "Update must be read-your-write");

    Awaitility.await("search converges to the final description, never the stale create-time value")
        .pollInterval(SEARCH_POLL)
        .atMost(SEARCH_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode source =
                  searchSourceById(client, table.getFullyQualifiedName(), table.getId().toString());
              assertNotNull(source, "Doc not yet indexed");
              assertEquals(
                  finalDescription,
                  source.path("description").asText(""),
                  "Same-entity ordering must apply the update after the create");
            });
  }

  private void awaitSearchHit(OpenMetadataClient client, String query, String entityId) {
    Awaitility.await("entity " + entityId + " becomes searchable")
        .pollInterval(SEARCH_POLL)
        .atMost(SEARCH_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertNotNull(searchSourceById(client, query, entityId), "Doc not yet searchable"));
  }

  private JsonNode searchSourceById(OpenMetadataClient client, String fqn, String entityId)
      throws Exception {
    // Pin the exact doc with a term filter on the keyword fullyQualifiedName, not a free-text query
    // of the FQN: the latter explodes into >1024 boolean clauses and trips OpenSearch's default
    // index.query.bool.max_clause_count (Elasticsearch allows far more), 500ing the search. A
    // single
    // term clause matches regardless of how many tables the suite has indexed.
    String filter = "{\"query\":{\"term\":{\"fullyQualifiedName\":\"" + fqn + "\"}}}";
    String response =
        client
            .search()
            .query("*")
            .index(TABLE_SEARCH_INDEX)
            .queryFilter(filter)
            .size(10)
            .deleted(false)
            .execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    JsonNode result = null;
    for (JsonNode hit : hits) {
      if (entityId.equals(hit.path("_source").path("id").asText(""))) {
        result = hit.path("_source");
        break;
      }
    }
    return result;
  }

  private Table createTable(TestNamespace ns, String baseName, String description) {
    String shortId = ns.shortPrefix();
    DatabaseService dbService =
        DatabaseServices.builder()
            .name("async_svc_" + shortId + "_" + baseName)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Async consistency test service")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("async_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("async_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setDescription(description);
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    return SdkClients.adminClient().tables().create(tableRequest);
  }
}
