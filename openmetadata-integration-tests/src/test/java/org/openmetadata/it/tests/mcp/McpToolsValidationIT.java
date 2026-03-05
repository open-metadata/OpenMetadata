package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class McpToolsValidationIT extends McpTestBase {

  private static Table testTable;
  private static DatabaseSchema testSchema;
  private static String testGlossaryName;

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
    createTestEntities();
  }

  private static void createTestEntities() throws Exception {
    String serviceName = "mcp_val_service_" + UUID.randomUUID().toString().substring(0, 8);
    DatabaseConnection connection =
        new DatabaseConnection()
            .withConfig(
                new MysqlConnection()
                    .withHostPort("localhost:3306")
                    .withUsername("test")
                    .withAuthType(new basicAuth().withPassword("test")));

    CreateDatabaseService createDatabaseService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(connection);

    DatabaseService databaseService =
        post("services/databaseServices", createDatabaseService, DatabaseService.class);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("mcp_val_database_" + UUID.randomUUID().toString().substring(0, 8))
            .withDescription("Test database for MCP validation")
            .withService(databaseService.getFullyQualifiedName());

    Database testDatabase = post("databases", createDatabase, Database.class);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("mcp_val_schema")
            .withDescription("Test schema for MCP validation")
            .withDatabase(testDatabase.getFullyQualifiedName());

    testSchema = post("databaseSchemas", createSchema, DatabaseSchema.class);

    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(50)
                .withDescription("Entity name"),
            new Column()
                .withName("created_at")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp"));

    CreateTable createTable =
        new CreateTable()
            .withName("mcp_val_table")
            .withDescription("Test table for MCP validation")
            .withDatabaseSchema(testSchema.getFullyQualifiedName())
            .withColumns(columns);

    testTable = post("tables", createTable, Table.class);

    testGlossaryName = "McpValidationGlossary" + System.currentTimeMillis();
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(testGlossaryName)
            .withDescription("Test glossary for MCP validation");
    post("glossaries", createGlossary, Glossary.class);
  }

  private JsonNode executeToolCall(Map<String, Object> toolCallRequest) throws Exception {
    JsonNode responseJson = executeMcpRequest(toolCallRequest);
    assertThat(responseJson.has("result")).isTrue();
    return responseJson.get("result");
  }

  @Test
  @Order(1)
  void testSearchMetadataTool() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createSearchMetadataToolCall("mcp_val_table", 5, Entity.TABLE);
    JsonNode result = executeToolCall(toolCall);
    validateSearchMetadataResponse(result, "mcp_val_table");
  }

  @Test
  @Order(2)
  void testGetEntityDetailsTool() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createGetEntityToolCall("table", testTable.getFullyQualifiedName());
    JsonNode result = executeToolCall(toolCall);
    validateGetEntityDetailsResponse(result, testTable.getFullyQualifiedName());
  }

  @Test
  @Order(3)
  void testCreateGlossaryTool() throws Exception {
    String randomGlossaryName = "randomGlossary";
    Map<String, Object> toolCall =
        McpTestUtils.createGlossaryToolCall(
            randomGlossaryName, "Test glossary created for validation testing");
    JsonNode result = executeToolCall(toolCall);
    validateCreateGlossaryResponse(result, randomGlossaryName);
  }

  @Test
  @Order(4)
  void testCreateGlossaryTermTool() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createGlossaryTermToolCall(
            testGlossaryName, "ValidationTestTerm", "Test term created for validation testing");
    JsonNode result = executeToolCall(toolCall);
    validateCreateGlossaryTermResponse(result, "ValidationTestTerm", testGlossaryName);
  }

  @Test
  @Order(5)
  void testPatchEntityTool() throws Exception {
    String patchJson =
        "[{\"op\": \"add\", \"path\": \"/description\", \"value\": \"Updated description via MCP patch tool\"}]";
    Map<String, Object> toolCall =
        McpTestUtils.createPatchEntityToolCall(
            "table", testTable.getFullyQualifiedName(), patchJson);

    JsonNode result = executeToolCall(toolCall);
    validatePatchEntityResponse(result, testTable.getFullyQualifiedName());
  }

  @Test
  @Order(6)
  void testGetEntityLineageTool() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createGetLineageToolCall("table", testTable.getFullyQualifiedName(), 2, 2);

    JsonNode result = executeToolCall(toolCall);
    validateLineageResponse(result, testTable.getFullyQualifiedName());
  }

  @Test
  @Order(7)
  void testAllToolsValidation() throws Exception {
    Map<String, Object> searchCall =
        McpTestUtils.createSearchMetadataToolCall("mcp_val", 10, Entity.TABLE);
    JsonNode searchResult = executeToolCall(searchCall);
    validateSearchMetadataResponse(searchResult, "mcp_val");

    Map<String, Object> tableDetailsCall =
        McpTestUtils.createGetEntityToolCall("table", testTable.getFullyQualifiedName());
    JsonNode tableResult = executeToolCall(tableDetailsCall);
    validateGetEntityDetailsResponse(tableResult, testTable.getFullyQualifiedName());
  }

  @Test
  @Order(8)
  void testCreateLineage() throws Exception {
    CreateTable createTable2 =
        new CreateTable()
            .withName("mcp_lineage_target_table")
            .withDescription("Target table for lineage test")
            .withDatabaseSchema(testSchema.getFullyQualifiedName())
            .withColumns(testTable.getColumns());
    Table targetTable = post("tables", createTable2, Table.class);

    Map<String, Object> toolCall =
        McpTestUtils.createLineageToolCall(
            "table", testTable.getId().toString(), "table", targetTable.getId().toString());
    JsonNode result = executeToolCall(toolCall);

    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
    assertThat(response.has("result")).isTrue();
    assertThat(response.get("result").asText()).contains("successfully");

    Map<String, Object> getLineageCall =
        McpTestUtils.createGetLineageToolCall("table", testTable.getFullyQualifiedName(), 1, 1);
    JsonNode lineageResult = executeToolCall(getLineageCall);
    validateLineageResponse(lineageResult, testTable.getFullyQualifiedName());
  }

  @Test
  @Order(9)
  void testCreateLineageMissingParams() throws Exception {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("Authorization", McpTestUtils.createAuthorizationHeader("test-token"));
    Map<String, Object> toolCall = McpTestUtils.createToolCallRequest("create_lineage", arguments);

    JsonNode result = executeToolCall(toolCall);
    assertThat(result.has("content")).isTrue();
    assertThat(result.has("isError")).isTrue();
    assertThat(result.get("isError").asBoolean()).isTrue();
  }

  @Test
  @Order(10)
  void testGetTestDefinitions() throws Exception {
    Map<String, Object> toolCall = McpTestUtils.createGetTestDefinitionsToolCall("TABLE");
    JsonNode result = executeToolCall(toolCall);

    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
    assertThat(response.has("data")).isTrue();
    assertThat(response.get("data").isArray()).isTrue();
    assertThat(response.get("data").size()).isGreaterThan(0);
  }

  @Test
  @Order(11)
  void testGetTestDefinitionsForColumn() throws Exception {
    Map<String, Object> toolCall = McpTestUtils.createGetTestDefinitionsToolCall("COLUMN");
    JsonNode result = executeToolCall(toolCall);

    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
    assertThat(response.has("data")).isTrue();
    assertThat(response.get("data").isArray()).isTrue();
  }

  @Test
  @Order(12)
  void testCreateTestCase() throws Exception {
    String testCaseName = "mcp_test_case_" + System.currentTimeMillis();
    List<Map<String, String>> parameterValues =
        List.of(
            Map.of("name", "minValue", "value", "0"), Map.of("name", "maxValue", "value", "100"));

    Map<String, Object> toolCall =
        McpTestUtils.createTestCaseToolCall(
            testCaseName,
            testTable.getFullyQualifiedName(),
            "tableRowCountToBeBetween",
            parameterValues);
    JsonNode result = executeToolCall(toolCall);

    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
    assertThat(response.has("name")).isTrue();
    assertThat(response.get("name").asText()).isEqualTo(testCaseName);
  }

  @Test
  @Order(13)
  void testCreateTestCaseMissingDefinition() throws Exception {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("name", "some_test");
    arguments.put("fqn", testTable.getFullyQualifiedName());
    arguments.put("parameterValues", List.of());
    arguments.put("Authorization", McpTestUtils.createAuthorizationHeader("test-token"));
    Map<String, Object> toolCall =
        McpTestUtils.createToolCallRequest("create_test_case", arguments);

    JsonNode result = executeToolCall(toolCall);
    assertThat(result.has("isError")).isTrue();
    assertThat(result.get("isError").asBoolean()).isTrue();
  }

  @Test
  @Order(14)
  void testRootCauseAnalysis() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createRootCauseAnalysisToolCall(
            testTable.getFullyQualifiedName(), "table", 3, 3);
    JsonNode result = executeToolCall(toolCall);

    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
    assertThat(response.has("status")).isTrue();
    assertThat(response.has("upstreamAnalysis")).isTrue();
    assertThat(response.has("downstreamAnalysis")).isTrue();
  }

  @Test
  @Order(15)
  void testRootCauseAnalysisDepthClamping() throws Exception {
    Map<String, Object> toolCall =
        McpTestUtils.createRootCauseAnalysisToolCall(
            testTable.getFullyQualifiedName(), "table", 50, 50);
    JsonNode result = executeToolCall(toolCall);

    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
    assertThat(response.has("upstreamDepth")).isTrue();
    assertThat(response.get("upstreamDepth").asInt()).isEqualTo(10);
    assertThat(response.has("downstreamDepth")).isTrue();
    assertThat(response.get("downstreamDepth").asInt()).isEqualTo(10);
  }

  @Test
  @Order(16)
  void testSearchMetadataIncludesDeletedField() throws Exception {
    String deletionTestTableName = "mcp_deletion_test_table_" + System.currentTimeMillis();
    CreateTable createDeletionTestTable =
        new CreateTable()
            .withName(deletionTestTableName)
            .withDescription("Test table for deletion testing")
            .withDatabaseSchema(testSchema.getFullyQualifiedName())
            .withColumns(testTable.getColumns());

    Table deletionTestTable = post("tables", createDeletionTestTable, Table.class);

    Map<String, Object> searchActive =
        McpTestUtils.createSearchMetadataToolCall(deletionTestTableName, 5, Entity.TABLE);
    JsonNode activeResult = executeToolCall(searchActive);
    validateDeletedFieldPresence(activeResult, false);

    delete("tables/" + deletionTestTable.getId());

    Map<String, Object> searchWithDeleted =
        createSearchToolCallWithDeletedParam(deletionTestTableName, 5, Entity.TABLE, true);
    JsonNode deletedResult = executeToolCall(searchWithDeleted);
    validateDeletedFieldPresence(deletedResult, true);

    Map<String, Object> searchDefault =
        McpTestUtils.createSearchMetadataToolCall(deletionTestTableName, 5, Entity.TABLE);
    JsonNode defaultResult = executeToolCall(searchDefault);
    validateNoDeletedEntities(defaultResult);
  }

  private Map<String, Object> createSearchToolCallWithDeletedParam(
      String query, int limit, String entityType, boolean includeDeleted) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("query", query);
    arguments.put("limit", limit);
    arguments.put("entityType", entityType);
    arguments.put("includeDeleted", includeDeleted);
    arguments.put("Authorization", McpTestUtils.createAuthorizationHeader("test-token"));

    return McpTestUtils.createToolCallRequest("search_metadata", arguments);
  }

  private void validateSearchMetadataResponse(JsonNode result, String expectedQuery)
      throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();

    if (content.size() > 0) {
      JsonNode firstResult = content.get(0);
      assertThat(firstResult.has("text")).isTrue();
      JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());

      assertThat(response.has("query")).isTrue();
      assertEquals(response.get("query").asText(), expectedQuery);

      Set<String> matchingEntities = new HashSet<>();
      response
          .get("results")
          .forEach(
              r -> {
                assertThat(r.has("name")).isTrue();
                assertThat(r.has("fullyQualifiedName")).isTrue();
                assertThat(r.has("entityType")).isTrue();
                assertThat(r.has("deleted"))
                    .withFailMessage(
                        "Missing 'deleted' field in search result for: " + r.get("name"))
                    .isTrue();
                matchingEntities.add(r.get("name").asText());
              });

      assertThat(matchingEntities.stream().anyMatch(name -> name.contains(expectedQuery)))
          .withFailMessage(
              "Expected at least one entity name containing '%s' but got: %s",
              expectedQuery, matchingEntities)
          .isTrue();
    }
  }

  private void validateGetEntityDetailsResponse(JsonNode result, String expectedFqn)
      throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    String responseText = firstResult.get("text").asText();

    JsonNode entityData = OBJECT_MAPPER.readTree(responseText);
    assertThat(entityData.has("id")).isTrue();
    assertThat(entityData.has("name")).isTrue();
    assertThat(entityData.has("fullyQualifiedName")).isTrue();
    assertThat(entityData.get("fullyQualifiedName").asText()).isEqualTo(expectedFqn);

    if (entityData.has("columns")) {
      JsonNode columns = entityData.get("columns");
      assertThat(columns.isArray()).isTrue();
      if (columns.size() > 0) {
        JsonNode column = columns.get(0);
        assertThat(column.has("name")).isTrue();
        assertThat(column.has("dataType")).isTrue();
      }
    }
  }

  private void validateCreateGlossaryResponse(JsonNode result, String expectedName)
      throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    String responseText = firstResult.get("text").asText();

    JsonNode glossaryData = OBJECT_MAPPER.readTree(responseText);
    assertThat(glossaryData.has("id")).isTrue();
    assertThat(glossaryData.has("name")).isTrue();
    assertThat(glossaryData.get("name").asText()).isEqualTo(expectedName);
    assertThat(glossaryData.has("fullyQualifiedName")).isTrue();
  }

  private void validateCreateGlossaryTermResponse(
      JsonNode result, String expectedTermName, String expectedGlossaryName) throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    String responseText = firstResult.get("text").asText();

    JsonNode termData = OBJECT_MAPPER.readTree(responseText);
    assertThat(termData.has("id")).isTrue();
    assertThat(termData.has("name")).isTrue();
    assertThat(termData.get("name").asText()).isEqualTo(expectedTermName);
    assertThat(termData.has("glossary")).isTrue();

    JsonNode glossary = termData.get("glossary");
    assertThat(glossary.has("name")).isTrue();
    assertThat(glossary.get("name").asText()).isEqualTo(expectedGlossaryName);
  }

  private void validatePatchEntityResponse(JsonNode result, String patchedEntity) throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    String responseText = firstResult.get("text").asText();

    JsonNode entityData = OBJECT_MAPPER.readTree(responseText).get("entity");
    assertThat(entityData.has("id")).isTrue();
    assertThat(entityData.has("description")).isTrue();
    assertThat(entityData.get("description").asText())
        .contains("Updated description via MCP patch tool");
    assertThat(entityData.has("fullyQualifiedName")).isTrue();
    assertThat(entityData.get("fullyQualifiedName").asText()).isEqualTo(patchedEntity);
  }

  private void validateLineageResponse(JsonNode result, String expectedEntityFqn) throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();
    assertThat(content.size()).isGreaterThan(0);

    JsonNode firstResult = content.get(0);
    assertThat(firstResult.has("text")).isTrue();
    String responseText = firstResult.get("text").asText();

    JsonNode lineageData = OBJECT_MAPPER.readTree(responseText);
    assertThat(lineageData.has("entity")).isTrue();

    JsonNode entity = lineageData.get("entity");
    assertThat(entity.has("fullyQualifiedName")).isTrue();
    assertThat(entity.get("fullyQualifiedName").asText()).isEqualTo(expectedEntityFqn);

    assertThat(lineageData.has("nodes")).isTrue();
    assertThat(lineageData.has("upstreamEdges")).isTrue();
    assertThat(lineageData.has("downstreamEdges")).isTrue();
  }

  private void validateDeletedFieldPresence(JsonNode result, boolean expectedDeleted)
      throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");
    assertThat(content.isArray()).isTrue();

    if (content.size() > 0) {
      JsonNode firstResult = content.get(0);
      JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
      JsonNode results = response.get("results");

      assertThat(results).isNotNull();
      assertThat(results.size()).isGreaterThan(0);

      results.forEach(
          entity -> {
            assertThat(entity.has("deleted"))
                .withFailMessage(
                    "Missing 'deleted' field for entity: %s (entityType: %s)",
                    entity.has("name") ? entity.get("name").asText() : "unknown",
                    entity.has("entityType") ? entity.get("entityType").asText() : "unknown")
                .isTrue();

            assertThat(entity.get("deleted").asBoolean())
                .withFailMessage(
                    "Expected deleted=%s but got deleted=%s for entity: %s",
                    expectedDeleted, entity.get("deleted").asBoolean(), entity.get("name").asText())
                .isEqualTo(expectedDeleted);
          });
    }
  }

  private void validateNoDeletedEntities(JsonNode result) throws Exception {
    assertThat(result.has("content")).isTrue();
    JsonNode content = result.get("content");

    if (content.size() > 0) {
      JsonNode firstResult = content.get(0);
      JsonNode response = OBJECT_MAPPER.readTree(firstResult.get("text").asText());
      JsonNode results = response.get("results");

      if (results != null && results.size() > 0) {
        results.forEach(
            entity -> {
              if (entity.has("deleted")) {
                assertThat(entity.get("deleted").asBoolean())
                    .withFailMessage(
                        "Found soft-deleted entity in default search: %s",
                        entity.get("name").asText())
                    .isFalse();
              }
            });
      }
    }
  }
}
