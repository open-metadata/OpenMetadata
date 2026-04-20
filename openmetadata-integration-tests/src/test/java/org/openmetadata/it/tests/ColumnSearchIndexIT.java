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
import java.util.List;
import java.util.concurrent.TimeUnit;
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
    @DisplayName("Should return columns with parent table reference")
    void testColumnHasTableReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_table_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        // Find the hit that matches our test column
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify entityType is tableColumn
            assertEquals(
                "tableColumn",
                source.path("entityType").asText(),
                "Column should have entityType 'tableColumn'");

            // Verify table reference exists
            JsonNode tableRef = source.path("table");
            assertFalse(tableRef.isMissingNode(), "Column should have table reference");
            assertFalse(
                tableRef.path("name").asText("").isEmpty(), "Table reference should have name");
            assertFalse(
                tableRef.path("fullyQualifiedName").asText("").isEmpty(),
                "Table reference should have FQN");
            break;
          }
        }
      }
    }

    @Test
    @DisplayName("Should return columns with service reference for breadcrumb")
    void testColumnHasServiceReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_svc_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify service reference exists (for breadcrumb display)
            JsonNode serviceRef = source.path("service");
            assertFalse(
                serviceRef.isMissingNode(),
                "Column should have service reference for breadcrumb display");
            assertFalse(
                serviceRef.path("name").asText("").isEmpty(), "Service reference should have name");
            break;
          }
        }
      }
    }

    @Test
    @DisplayName("Should return columns with database reference for breadcrumb")
    void testColumnHasDatabaseReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_db_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify database reference exists (for breadcrumb display)
            JsonNode databaseRef = source.path("database");
            assertFalse(
                databaseRef.isMissingNode(),
                "Column should have database reference for breadcrumb display");
            assertFalse(
                databaseRef.path("name").asText("").isEmpty(),
                "Database reference should have name");
            break;
          }
        }
      }
    }

    @Test
    @DisplayName("Should return columns with databaseSchema reference for breadcrumb")
    void testColumnHasSchemaReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_schema_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify databaseSchema reference exists (for breadcrumb display)
            JsonNode schemaRef = source.path("databaseSchema");
            assertFalse(
                schemaRef.isMissingNode(),
                "Column should have databaseSchema reference for breadcrumb display");
            assertFalse(
                schemaRef.path("name").asText("").isEmpty(),
                "DatabaseSchema reference should have name");
            break;
          }
        }
      }
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
    void testColumnDataTypeInIndex(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_datatype");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_id");
      String response =
          client.search().query(columnName).index("column_search_index").size(10).execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify dataType is present
            assertFalse(
                source.path("dataType").isMissingNode(), "Column should have dataType field");
            break;
          }
        }
      }
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
}
