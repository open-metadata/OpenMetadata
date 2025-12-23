package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for generic entity operations.
 *
 * <p>Tests generic entity endpoints and operations that work across all entity types including: -
 * Entity type listing - Entity counts - Entity type metadata retrieval - Cross-entity operations
 *
 * <p>Test isolation: Uses TestNamespace for unique entity names Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class EntityResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_listEntityTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/metadata/types", null, RequestOptions.builder().build());

    assertNotNull(responseJson, "Entity types response should not be null");
    assertFalse(responseJson.isEmpty(), "Entity types response should not be empty");

    JsonNode responseNode = MAPPER.readTree(responseJson);
    assertTrue(responseNode.has("data"), "Response should have 'data' field");

    JsonNode dataArray = responseNode.get("data");
    assertTrue(dataArray.isArray(), "Data should be an array");
    assertTrue(dataArray.size() > 0, "Should have at least one entity type");

    Set<String> typeNames =
        MAPPER.convertValue(dataArray, new TypeReference<List<Map<String, Object>>>() {}).stream()
            .map(type -> (String) type.get("name"))
            .collect(Collectors.toSet());

    assertTrue(typeNames.contains("table"), "Should include 'table' entity type");
    assertTrue(typeNames.contains("database"), "Should include 'database' entity type");
    assertTrue(typeNames.contains("user"), "Should include 'user' entity type");
    assertTrue(typeNames.contains("team"), "Should include 'team' entity type");
  }

  @Test
  void test_getEntityTypeByName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/table",
                null,
                RequestOptions.builder().build());

    assertNotNull(responseJson, "Entity type response should not be null");
    assertFalse(responseJson.isEmpty(), "Entity type response should not be empty");

    JsonNode typeNode = MAPPER.readTree(responseJson);
    assertEquals("table", typeNode.get("name").asText(), "Type name should be 'table'");
    assertTrue(typeNode.has("schema"), "Type should have 'schema' field");
    assertTrue(typeNode.has("category"), "Type should have 'category' field");
  }

  @Test
  void test_getEntityTypeFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/database/fields",
                null,
                RequestOptions.builder().build());

    assertNotNull(responseJson, "Entity type fields response should not be null");
    assertFalse(responseJson.isEmpty(), "Entity type fields response should not be empty");

    JsonNode fieldsArray = MAPPER.readTree(responseJson);
    assertTrue(fieldsArray.isArray(), "Fields response should be an array");
    assertTrue(fieldsArray.size() > 0, "Database entity should have fields");

    List<Map<String, Object>> fields =
        MAPPER.convertValue(fieldsArray, new TypeReference<List<Map<String, Object>>>() {});

    boolean hasNameField = fields.stream().anyMatch(f -> "name".equals(f.get("name")));
    assertTrue(hasNameField, "Database entity should have 'name' field");

    boolean hasFqnField = fields.stream().anyMatch(f -> "fullyQualifiedName".equals(f.get("name")));
    assertTrue(hasFqnField, "Database entity should have 'fullyQualifiedName' field");

    boolean hasServiceField = fields.stream().anyMatch(f -> "service".equals(f.get("name")));
    assertTrue(hasServiceField, "Database entity should have 'service' field");
  }

  @Test
  void test_listEntityTypesByCategory(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types?category=entity",
                null,
                RequestOptions.builder().build());

    assertNotNull(responseJson, "Entity types by category response should not be null");

    JsonNode responseNode = MAPPER.readTree(responseJson);
    assertTrue(responseNode.has("data"), "Response should have 'data' field");

    JsonNode dataArray = responseNode.get("data");
    assertTrue(dataArray.isArray(), "Data should be an array");

    List<Map<String, Object>> types =
        MAPPER.convertValue(dataArray, new TypeReference<List<Map<String, Object>>>() {});

    boolean allEntityCategory = types.stream().allMatch(t -> "entity".equals(t.get("category")));
    assertTrue(allEntityCategory, "All types should be of category 'entity'");
  }

  @Test
  void test_getEntitiesCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService service = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/entities/count", null, RequestOptions.builder().build());

    assertNotNull(responseJson, "Entities count response should not be null");
    assertFalse(responseJson.isEmpty(), "Entities count response should not be empty");

    JsonNode countsNode = MAPPER.readTree(responseJson);
    assertTrue(countsNode.has("tableCount"), "Should have table count");
    assertTrue(countsNode.has("databaseCount"), "Should have database count");
    assertTrue(countsNode.has("userCount"), "Should have user count");
    assertTrue(countsNode.has("teamCount"), "Should have team count");

    int tableCount = countsNode.get("tableCount").asInt();
    assertTrue(tableCount > 0, "Table count should be greater than 0");
  }

  @Test
  void test_getEntitiesCountWithInclude(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String allResponseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/entities/count?include=all",
                null,
                RequestOptions.builder().build());

    assertNotNull(allResponseJson, "All entities count response should not be null");

    JsonNode allCountsNode = MAPPER.readTree(allResponseJson);
    assertTrue(allCountsNode.has("tableCount"), "Should have table count");

    String nonDeletedResponseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/entities/count?include=non-deleted",
                null,
                RequestOptions.builder().build());

    assertNotNull(nonDeletedResponseJson, "Non-deleted entities count should not be null");

    JsonNode nonDeletedCountsNode = MAPPER.readTree(nonDeletedResponseJson);
    assertTrue(nonDeletedCountsNode.has("tableCount"), "Should have table count");

    int allTableCount = allCountsNode.get("tableCount").asInt();
    int nonDeletedTableCount = nonDeletedCountsNode.get("tableCount").asInt();

    assertTrue(allTableCount >= nonDeletedTableCount, "All count should be >= non-deleted count");
  }

  @Test
  void test_entityTypeMetadata(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] entityTypes = {"table", "database", "user", "team", "topic", "dashboard"};

    for (String entityType : entityTypes) {
      String responseJson =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/metadata/types/name/" + entityType,
                  null,
                  RequestOptions.builder().build());

      assertNotNull(responseJson, "Entity type metadata should not be null for " + entityType);

      JsonNode typeNode = MAPPER.readTree(responseJson);
      assertEquals(
          entityType, typeNode.get("name").asText(), "Type name should match for " + entityType);
      assertTrue(typeNode.has("id"), "Type should have 'id' field");
      assertTrue(typeNode.has("category"), "Type should have 'category' field");
      assertTrue(typeNode.has("schema"), "Type should have 'schema' field");
    }
  }

  @Test
  void test_entityTypeFieldsForComplexEntities(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/table/fields",
                null,
                RequestOptions.builder().build());

    JsonNode fieldsArray = MAPPER.readTree(responseJson);
    List<Map<String, Object>> fields =
        MAPPER.convertValue(fieldsArray, new TypeReference<List<Map<String, Object>>>() {});

    boolean hasColumns = fields.stream().anyMatch(f -> "columns".equals(f.get("name")));
    assertTrue(hasColumns, "Table entity should have 'columns' field");

    boolean hasTableConstraints =
        fields.stream().anyMatch(f -> "tableConstraints".equals(f.get("name")));
    assertTrue(hasTableConstraints, "Table entity should have 'tableConstraints' field");

    boolean hasDatabaseSchema =
        fields.stream().anyMatch(f -> "databaseSchema".equals(f.get("name")));
    assertTrue(hasDatabaseSchema, "Table entity should have 'databaseSchema' field");

    Map<String, Object> columnsField =
        fields.stream().filter(f -> "columns".equals(f.get("name"))).findFirst().orElse(null);

    assertNotNull(columnsField, "Columns field should exist");
    assertNotNull(columnsField.get("type"), "Columns field should have type");
  }

  @Test
  void test_listEntityTypesWithLimit(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types?limit=5",
                null,
                RequestOptions.builder().build());

    assertNotNull(responseJson, "Limited entity types response should not be null");

    JsonNode responseNode = MAPPER.readTree(responseJson);
    assertTrue(responseNode.has("data"), "Response should have 'data' field");

    JsonNode dataArray = responseNode.get("data");
    assertTrue(dataArray.isArray(), "Data should be an array");
    assertTrue(dataArray.size() <= 5, "Should return at most 5 types");
  }

  @Test
  void test_entityTypeValidation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.GET,
              "/v1/metadata/types/name/nonExistentEntityType",
              null,
              RequestOptions.builder().build());
      fail("Should throw exception for non-existent entity type");
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("404") || e.getMessage().contains("not found"),
          "Should return 404 for non-existent entity type");
    }
  }

  @Test
  void test_entityFieldTypesAreConsistent(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] entitiesWithOwners = {"table", "database", "dashboard", "topic", "pipeline"};

    for (String entityType : entitiesWithOwners) {
      String responseJson =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/metadata/types/name/" + entityType + "/fields",
                  null,
                  RequestOptions.builder().build());

      JsonNode fieldsArray = MAPPER.readTree(responseJson);
      List<Map<String, Object>> fields =
          MAPPER.convertValue(fieldsArray, new TypeReference<List<Map<String, Object>>>() {});

      boolean hasOwners = fields.stream().anyMatch(f -> "owners".equals(f.get("name")));
      assertTrue(hasOwners, entityType + " entity should have 'owners' field");

      boolean hasTags = fields.stream().anyMatch(f -> "tags".equals(f.get("name")));
      assertTrue(hasTags, entityType + " entity should have 'tags' field");

      boolean hasDescription = fields.stream().anyMatch(f -> "description".equals(f.get("name")));
      assertTrue(hasDescription, entityType + " entity should have 'description' field");
    }
  }
}
