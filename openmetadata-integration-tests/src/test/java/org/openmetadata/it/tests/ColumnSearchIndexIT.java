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
    void testSearchColumnsByName(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_search_name");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, ns.prefix("user_email"), ns.prefix(""));
      assertNotNull(source, "Column should be searchable by name once indexed");
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
    void testColumnsInDataAssetIndex(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_dataasset");

      String columnName = ns.prefix("user_email");
      String queryFilter =
          "{\"query\":{\"bool\":{\"must\":["
              + "{\"term\":{\"entityType\":\"tableColumn\"}},"
              + "{\"term\":{\"name.keyword\":\""
              + columnName
              + "\"}}"
              + "]}}}";
      awaitDataAssetHasColumn(client, queryFilter, columnName);
    }

    @Test
    @DisplayName("Should filter tableColumn entities by database field")
    void testColumnFilterByDatabase(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithColumns(ns, "col_db_filter");

      String columnName = ns.prefix("user_email");
      String queryFilter =
          "{\"query\":{\"bool\":{\"must\":["
              + "{\"term\":{\"entityType\":\"tableColumn\"}},"
              + "{\"exists\":{\"field\":\"database\"}},"
              + "{\"term\":{\"name.keyword\":\""
              + columnName
              + "\"}}"
              + "]}}}";
      awaitDataAssetHasColumn(client, queryFilter, columnName);
    }
  }

  @Nested
  @DisplayName("Nested Column Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class NestedColumnTests {

    @Test
    @DisplayName("Should index nested columns (struct type)")
    void testNestedColumnsIndexed(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithNestedColumns(ns, "nested_cols");

      JsonNode source = awaitColumnSource(client, COLUMN_SEARCH_INDEX, "street", ns.prefix(""));
      assertNotNull(source, "Nested child column 'street' should be indexed");
    }

    @Test
    @DisplayName("Should index grandchild columns (deeply nested)")
    void testDeeplyNestedColumnsIndexed(TestNamespace ns) {
      OpenMetadataClient client = SdkClients.adminClient();
      createTableWithDeeplyNestedColumns(ns, "deep_nested");

      JsonNode source =
          awaitColumnSource(client, COLUMN_SEARCH_INDEX, "postal_code", ns.prefix(""));
      assertNotNull(source, "Deeply-nested grandchild column 'postal_code' should be indexed");
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
  // SEARCH POLLING HELPERS
  // ===================================================================

  private static final Duration POLL_AT_MOST = Duration.ofSeconds(60);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final String COLUMN_SEARCH_INDEX = "column_search_index";
  private static final String DATA_ASSET_INDEX = "dataAsset";

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

  private void awaitDataAssetHasColumn(
      OpenMetadataClient client, String queryFilter, String fqnNeedle) {
    Awaitility.await("tableColumn present in dataAsset index")
        .pollInterval(POLL_INTERVAL)
        .atMost(POLL_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(() -> assertTrue(dataAssetHasColumn(client, queryFilter, fqnNeedle)));
  }

  private boolean dataAssetHasColumn(
      OpenMetadataClient client, String queryFilter, String fqnNeedle) throws Exception {
    // Pin the column with a term filter on its keyword name (in queryFilter), not a free-text
    // query:
    // the dataAsset alias spans many indices/fields, so a free-text query of the column name
    // explodes
    // into >1024 boolean clauses and trips OpenSearch's default index.query.bool.max_clause_count
    // (Elasticsearch allows far more), 500ing the search. Match-all + the term filter returns the
    // exact column with a single clause, regardless of how many columns the suite has indexed.
    String response =
        client
            .search()
            .query("*")
            .index(DATA_ASSET_INDEX)
            .queryFilter(queryFilter)
            .size(50)
            .deleted(false)
            .execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    boolean found = false;
    for (JsonNode hit : hits) {
      if (hit.path("_source").path("fullyQualifiedName").asText("").contains(fqnNeedle)) {
        found = true;
        break;
      }
    }
    return found;
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
}
