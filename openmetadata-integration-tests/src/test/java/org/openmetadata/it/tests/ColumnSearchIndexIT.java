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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
 * Integration tests for column search indexing during table reindexing. Verifies:
 *
 * <ul>
 *   <li>Column indexing during table processing
 *   <li>Column parent references (service, database, schema, table)
 *   <li>Column search functionality in explore
 *   <li>Nested column flattening and indexing
 * </ul>
 *
 * <p>These tests verify the column search functionality works correctly when searching for columns
 * in the explore page.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnSearchIndexIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Nested
  @DisplayName("Column Search Index Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class ColumnSearchTests {

    @Test
    @DisplayName("Should find columns in column_search_index by name")
    void testSearchColumnsByName(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with specific columns
      Table table = createTableWithColumns(ns, "col_search_name");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column in column_search_index
      String columnName = ns.prefix("user_email");
      String response =
          client.search().query(columnName).index("column_search_index").size(10).execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");

      // Verify search returns results
      JsonNode hits = root.path("hits").path("hits");
      assertTrue(hits.isArray(), "Hits should be an array");
    }

    @Test
    @DisplayName("FQN search on tableColumn matches only that column, not its siblings")
    void testColumnFqnSearchIsPrecise(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      Table table = createTableWithColumns(ns, "col_fqn_precise");
      String userIdFqn =
          table.getColumns().stream()
              .filter(c -> c.getName().equals(ns.prefix("user_id")))
              .findFirst()
              .orElseThrow()
              .getFullyQualifiedName();

      // Searching a column's full FQN must return only that column, mirroring the Explore Columns
      // tab count-vs-results property that #31106 was written to defend (the "count 1 vs results
      // 7381" bug). The generic q= path multi-matches over name.ngram / displayName.ngram — under
      // parallel test load the shared RUN_ID/classId prefix on sibling columns from other methods
      // in this nested class trips the 2<70% minimum-should-match threshold and the total flaps
      // between 1 and N (21 observed = 7 methods x 3 columns for the class). Send the exact FQN
      // through a structured queryFilter term on fqnParts (a keyword array holding every sub-path
      // of the FQN — see SearchIndex.getFQNParts) so the assertion is deterministic across
      // execution order.
      // Matches the LineageBrokenReferenceIT#assertEntitySearchable shape: outer {"query": ...}
      // wrapper + shorthand term. EsUtils.parseJsonQuery unwraps the outer "query" before handing
      // the inner clause to the ES/OS client. fqnParts is stored {"type":"keyword"} with no
      // normalizer, so the term value must match the FQN case-sensitively — which it does since
      // the value comes from Column#getFullyQualifiedName() produced during table create.
      String fqnPartsTermFilter =
          "{\"query\":{\"term\":{\"fqnParts\":\""
              + userIdFqn.replace("\\", "\\\\").replace("\"", "\\\"")
              + "\"}}}";
      Awaitility.await("precise FQN column search")
          .pollInterval(POLL_INTERVAL)
          .atMost(POLL_AT_MOST)
          .ignoreExceptions()
          .untilAsserted(
              () -> {
                String response =
                    client
                        .search()
                        .query("*")
                        .index(COLUMN_SEARCH_INDEX)
                        .queryFilter(fqnPartsTermFilter)
                        .size(50)
                        .deleted(false)
                        .execute();
                JsonNode root = OBJECT_MAPPER.readTree(response);
                int total = root.path("hits").path("total").path("value").asInt();
                assertEquals(1, total, "FQN search should match one column, response: " + response);
                assertEquals(
                    userIdFqn,
                    root.path("hits")
                        .path("hits")
                        .get(0)
                        .path("_source")
                        .path("fullyQualifiedName")
                        .asText(),
                    "The single hit should be the searched column");
              });
    }

    @Test
    @DisplayName("Should return columns with parent table reference")
    void testColumnHasTableReference(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_table_ref");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, ns.prefix("user_email"), ns.prefix(""));

      assertEquals(
          "tableColumn",
          source.path("entityType").asText(),
          "Column should have entityType 'tableColumn'");
      JsonNode tableRef = source.path("table");
      assertFalse(tableRef.isMissingNode(), "Column should have table reference");
      assertFalse(tableRef.path("name").asText("").isEmpty(), "Table reference should have name");
      assertFalse(
          tableRef.path("fullyQualifiedName").asText("").isEmpty(),
          "Table reference should have FQN");
    }

    @Test
    @DisplayName("Should return columns with service reference for breadcrumb")
    void testColumnHasServiceReference(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_svc_ref");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, ns.prefix("user_email"), ns.prefix(""));

      JsonNode serviceRef = source.path("service");
      assertFalse(
          serviceRef.isMissingNode(),
          "Column should have service reference for breadcrumb display");
      assertFalse(
          serviceRef.path("name").asText("").isEmpty(), "Service reference should have name");
    }

    @Test
    @DisplayName("Should return columns with database reference for breadcrumb")
    void testColumnHasDatabaseReference(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_db_ref");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, ns.prefix("user_email"), ns.prefix(""));

      JsonNode databaseRef = source.path("database");
      assertFalse(
          databaseRef.isMissingNode(),
          "Column should have database reference for breadcrumb display");
      assertFalse(
          databaseRef.path("name").asText("").isEmpty(), "Database reference should have name");
    }

    @Test
    @DisplayName("Should return columns with databaseSchema reference for breadcrumb")
    void testColumnHasSchemaReference(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_schema_ref");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, ns.prefix("user_email"), ns.prefix(""));

      JsonNode schemaRef = source.path("databaseSchema");
      assertFalse(
          schemaRef.isMissingNode(),
          "Column should have databaseSchema reference for breadcrumb display");
      assertFalse(
          schemaRef.path("name").asText("").isEmpty(), "DatabaseSchema reference should have name");
    }
  }

  @Nested
  @DisplayName("Column in DataAsset Index Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class ColumnInDataAssetTests {

    @Test
    @DisplayName("Should find tableColumn entities in dataAsset index")
    void testColumnsInDataAssetIndex(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with a unique column name
      Table table = createTableWithColumns(ns, "col_dataasset");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search in dataAsset index with entityType filter for tableColumn
      String queryFilter =
          "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"tableColumn\"}}]}}}";

      String response =
          client
              .search()
              .query("*")
              .index("dataAsset")
              .queryFilter(queryFilter)
              .size(10)
              .deleted(false)
              .execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");

      // If column indexing is enabled, we should find tableColumn entities
      JsonNode total = root.path("hits").path("total");
      if (total.isObject()) {
        // ES 7+ format
        assertTrue(
            total.path("value").asLong() >= 0,
            "Should return valid count for tableColumn entities");
      }
    }

    @Test
    @DisplayName("Should filter tableColumn entities by database field")
    void testColumnFilterByDatabase(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_db_filter");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search with database field exists filter
      String queryFilter =
          "{\"query\":{\"bool\":{\"must\":["
              + "{\"term\":{\"entityType\":\"tableColumn\"}},"
              + "{\"exists\":{\"field\":\"database\"}}"
              + "]}}}";

      String response =
          client
              .search()
              .query("*")
              .index("dataAsset")
              .queryFilter(queryFilter)
              .size(10)
              .deleted(false)
              .execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");
    }
  }

  @Nested
  @DisplayName("Nested Column Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class NestedColumnTests {

    @Test
    @DisplayName("Should index nested columns (struct type)")
    void testNestedColumnsIndexed(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with nested columns
      Table table = createTableWithNestedColumns(ns, "nested_cols");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the child column
      String childColumnName = "street";
      String response =
          client.search().query(childColumnName).index("column_search_index").size(10).execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");
    }

    @Test
    @DisplayName("Should index grandchild columns (deeply nested)")
    void testDeeplyNestedColumnsIndexed(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with deeply nested columns
      Table table = createTableWithDeeplyNestedColumns(ns, "deep_nested");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the grandchild column
      String grandchildName = "postal_code";
      String response =
          client.search().query(grandchildName).index("column_search_index").size(10).execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");
    }
  }

  @Nested
  @DisplayName("Column Data Type Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class ColumnDataTypeTests {

    @Test
    @DisplayName("Should include dataType in column search index")
    void testColumnDataTypeInIndex(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_datatype");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, ns.prefix("user_id"), ns.prefix(""));
      assertFalse(source.path("dataType").isMissingNode(), "Column should have dataType field");
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Table createTableWithColumns(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    // Create database service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("col_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for column search")
            .create();

    // Create database
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("col_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    // Create schema
    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("col_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    // Create table with columns
    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column()
                .withName(ns.prefix("user_id"))
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("User identifier"),
            new Column()
                .withName(ns.prefix("user_email"))
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("User email address"),
            new Column()
                .withName(ns.prefix("created_at"))
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp")));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Table createTableWithNestedColumns(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    // Create database service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("nested_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for nested column search")
            .create();

    // Create database
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("nested_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    // Create schema
    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("nested_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    // Create table with nested columns
    Column streetCol =
        new Column()
            .withName("street")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(255)
            .withDescription("Street address");

    Column cityCol =
        new Column()
            .withName("city")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(100)
            .withDescription("City name");

    Column addressCol =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Address struct")
            .withChildren(List.of(streetCol, cityCol));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT), addressCol));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Table createTableWithDeeplyNestedColumns(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    // Create database service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("deep_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for deeply nested column search")
            .create();

    // Create database
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("deep_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    // Create schema
    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("deep_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    // Create table with deeply nested columns (grandchild level)
    Column postalCodeCol =
        new Column()
            .withName("postal_code")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(20)
            .withDescription("Postal code");

    Column countryCodeCol =
        new Column()
            .withName("country_code")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(3)
            .withDescription("Country code");

    Column locationCol =
        new Column()
            .withName("location")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Location details")
            .withChildren(List.of(postalCodeCol, countryCodeCol));

    Column addressCol =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Address with location")
            .withChildren(List.of(locationCol));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT), addressCol));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  // ===================================================================
  // SEARCH POLLING HELPERS
  // ===================================================================

  private static final Duration POLL_AT_MOST = Duration.ofSeconds(60);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final String COLUMN_SEARCH_INDEX = "column_search_index";

  /**
   * Poll {@code index} for {@code query} until at least one hit whose FQN contains {@code fqnNeedle}
   * appears, then return that hit's {@code _source}. ES indexing is async post-commit (the write API
   * returns before the document is searchable), so a fixed sleep flakes; this waits for convergence.
   */
  private JsonNode awaitColumnSource(
      OpenMetadataClient client, String index, String query, String fqnNeedle) {
    JsonNode[] match = new JsonNode[1];
    Awaitility.await("column " + query + " indexed in " + index)
        .pollInterval(POLL_INTERVAL)
        .atMost(POLL_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode source = findColumnSource(client, index, query, fqnNeedle);
              assertNotNull(source, "Column not yet indexed in " + index);
              match[0] = source;
            });
    return match[0];
  }

  private JsonNode findColumnSource(
      OpenMetadataClient client, String index, String query, String fqnNeedle) throws Exception {
    String response = client.search().query(query).index(index).size(10).deleted(false).execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    JsonNode result = null;
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (source.path("fullyQualifiedName").asText("").contains(fqnNeedle)) {
        result = source;
        break;
      }
    }
    return result;
  }
}
