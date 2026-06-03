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
 * Stage-2 async-search-index consistency contract: the write API request thread does the DB
 * transaction + the cheap SYNC cache write-through, then RETURNS — it never blocks on the ES entity
 * index. ES indexing runs off the request thread on the per-entity-ordered {@code
 * OrderedLaneExecutor}.
 *
 * <ul>
 *   <li><b>Read-your-write stays real-time</b>: GET /entity/&#123;id&#125; (DB + sync cache) is
 *       immediately consistent after create/update.
 *   <li><b>Search is eventually consistent</b>: the document becomes searchable shortly after,
 *       polled with Awaitility.
 *   <li><b>Same-entity ordering</b>: a create immediately followed by an update converges in search
 *       to the FINAL value (never the stale create-time value, never a 404) — the regression guard
 *       for the lane FIFO guarantee. A pre-Stage-2 unordered pool would converge to a stale/missing
 *       doc and time out.
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

    // Async boundary: ES indexing runs off the request thread on the ordered lane, so create()
    // returns without waiting on the ES write — GET-by-id above is immediately read-your-write. We
    // deliberately do NOT hard-assert "not searchable the instant create() returns": on a fast host
    // the lane (a virtual thread) can index within the few ms before a same-thread search sample,
    // so
    // that assertion is inherently racy and would flake. The deterministic proof that indexing is
    // dispatched async lives in the unit tests (EntityLifecycleEventDispatcherTest /
    // OrderedLaneExecutorTest / SearchIndexHandlerTest.isAsync). The hard end-to-end guarantee here
    // is that the doc eventually converges in search:
    awaitSearchHit(client, tableId);
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
              JsonNode source = searchSourceById(client, table.getId().toString());
              assertNotNull(source, "Doc not yet indexed");
              assertEquals(
                  finalDescription,
                  source.path("description").asText(""),
                  "Same-entity ordering must apply the update after the create");
            });
  }

  private void awaitSearchHit(OpenMetadataClient client, String entityId) {
    Awaitility.await("entity " + entityId + " becomes searchable")
        .pollInterval(SEARCH_POLL)
        .atMost(SEARCH_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> assertNotNull(searchSourceById(client, entityId), "Doc not yet searchable"));
  }

  private JsonNode searchSourceById(OpenMetadataClient client, String entityId) throws Exception {
    String response =
        client.search().query("*").index(TABLE_SEARCH_INDEX).size(50).deleted(false).execute();
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
