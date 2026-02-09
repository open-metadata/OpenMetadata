package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests to verify the Elasticsearch/OpenSearch field limit fix.
 *
 * <p>These tests verify that:
 * <ul>
 *   <li>The extension field uses flattened/flat_object type (not dynamic object)</li>
 *   <li>The customPropertiesTyped nested field exists with proper structure for typed queries</li>
 *   <li>Creating many custom properties doesn't cause field explosion in the index</li>
 *   <li>The field count stays bounded regardless of custom property count</li>
 *   <li>Other dynamic object fields (votes, lifeCycle, etc.) have dynamic: false</li>
 * </ul>
 *
 * <p>This prevents the "Limit of total fields [1000] has been exceeded" error.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchIndexFieldLimitIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE_TYPE_NAME = "table";
  private static final int NUM_CUSTOM_PROPERTIES = 50;
  // Index name with cluster alias prefix (from TestSuiteBootstrap.ELASTIC_SEARCH_CLUSTER_ALIAS)
  private static final String TABLE_INDEX = "openmetadata_table_search_index";

  private static Type STRING_TYPE;
  private static Type INTEGER_TYPE;
  private static Type ENTITY_REFERENCE_TYPE;
  private static Type TIME_INTERVAL_TYPE;
  private static Type TABLE_TYPE;
  private static List<String> createdCustomPropertyNames = new ArrayList<>();

  private DatabaseService sharedDbService;
  private Database sharedDatabase;
  private DatabaseSchema sharedSchema;

  @BeforeAll
  static void setupTypes() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    STRING_TYPE = getTypeByName(client, "string");
    INTEGER_TYPE = getTypeByName(client, "integer");
    ENTITY_REFERENCE_TYPE = getTypeByName(client, "entityReference");
    TIME_INTERVAL_TYPE = getTypeByName(client, "timeInterval");
    TABLE_TYPE = getTypeByName(client, TABLE_TYPE_NAME);
  }

  @AfterAll
  static void cleanupCustomProperties() {
    try {
      OpenMetadataClient client = SdkClients.adminClient();
      for (String propName : createdCustomPropertyNames) {
        deleteCustomProperty(client, propName);
      }
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  /**
   * Test that the extension field uses flattened type in Elasticsearch mapping.
   * With flattened type, all custom properties are stored in a single field,
   * preventing field explosion.
   */
  @Test
  void testExtensionFieldIsFlattenedType(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/" + TABLE_INDEX + "/_mapping");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = OBJECT_MAPPER.readTree(responseBody);

    JsonNode extensionMapping = findExtensionMapping(root);
    assertNotNull(extensionMapping, "Extension field should exist in mapping");

    String extensionType = extensionMapping.path("type").asText();
    assertTrue(
        "flattened".equals(extensionType) || "flat_object".equals(extensionType),
        "Extension field should be flattened (ES) or flat_object (OpenSearch) type, but was: "
            + extensionType);
  }

  /**
   * Test that votes field has dynamic: false to prevent field explosion.
   */
  @Test
  void testVotesFieldHasDynamicFalse(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/" + TABLE_INDEX + "/_mapping");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = OBJECT_MAPPER.readTree(responseBody);

    JsonNode votesMapping = findFieldMapping(root, "votes");
    if (votesMapping != null && !votesMapping.isMissingNode()) {
      JsonNode dynamicSetting = votesMapping.path("dynamic");
      if (!dynamicSetting.isMissingNode()) {
        assertFalse(dynamicSetting.asBoolean(true), "votes field should have dynamic: false");
      }
    }
  }

  /**
   * Test that lifeCycle field has dynamic: false to prevent field explosion.
   */
  @Test
  void testLifeCycleFieldHasDynamicFalse(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/" + TABLE_INDEX + "/_mapping");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = OBJECT_MAPPER.readTree(responseBody);

    JsonNode lifeCycleMapping = findFieldMapping(root, "lifeCycle");
    if (lifeCycleMapping != null && !lifeCycleMapping.isMissingNode()) {
      JsonNode dynamicSetting = lifeCycleMapping.path("dynamic");
      if (!dynamicSetting.isMissingNode()) {
        assertFalse(dynamicSetting.asBoolean(true), "lifeCycle field should have dynamic: false");
      }
    }
  }

  /**
   * Test that customPropertiesTyped nested field exists for typed custom property queries.
   * This field enables range queries, exact matches, and structured queries on custom properties.
   */
  @Test
  void testCustomPropertiesTypedFieldExists(TestNamespace ns) throws Exception {
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    Request request = new Request("GET", "/" + TABLE_INDEX + "/_mapping");
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = OBJECT_MAPPER.readTree(responseBody);

    JsonNode customPropsTyped = findFieldMapping(root, "customPropertiesTyped");
    assertNotNull(customPropsTyped, "customPropertiesTyped field should exist");

    String fieldType = customPropsTyped.path("type").asText();
    assertEquals("nested", fieldType, "customPropertiesTyped should be nested type");

    // Verify nested field structure
    JsonNode properties = customPropsTyped.path("properties");
    assertFalse(properties.isMissingNode(), "customPropertiesTyped should have properties");

    // Check required nested fields exist
    assertTrue(properties.has("name"), "Should have 'name' field");
    assertTrue(properties.has("propertyType"), "Should have 'propertyType' field");
    assertTrue(properties.has("stringValue"), "Should have 'stringValue' field");
    assertTrue(properties.has("textValue"), "Should have 'textValue' field");
    assertTrue(properties.has("longValue"), "Should have 'longValue' field");
    assertTrue(properties.has("doubleValue"), "Should have 'doubleValue' field");
    assertTrue(properties.has("start"), "Should have 'start' field for timeInterval");
    assertTrue(properties.has("end"), "Should have 'end' field for timeInterval");
    assertTrue(properties.has("refId"), "Should have 'refId' field for entityReference");
    assertTrue(properties.has("refName"), "Should have 'refName' field for entityReference");

    // Verify field types
    assertEquals("keyword", properties.path("name").path("type").asText());
    assertEquals("keyword", properties.path("propertyType").path("type").asText());
    assertEquals("keyword", properties.path("stringValue").path("type").asText());
    assertEquals("text", properties.path("textValue").path("type").asText());
    assertEquals("long", properties.path("longValue").path("type").asText());
    assertEquals("double", properties.path("doubleValue").path("type").asText());
    assertEquals("long", properties.path("start").path("type").asText());
    assertEquals("long", properties.path("end").path("type").asText());
    assertEquals("keyword", properties.path("refId").path("type").asText());
    assertEquals("keyword", properties.path("refName").path("type").asText());
  }

  /**
   * Test that creating many custom properties and adding values to a table
   * doesn't cause field count explosion in Elasticsearch.
   */
  @Test
  void testManyCustomPropertiesDoNotExplodeFieldCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    int initialFieldCount = getFieldCount(searchClient, TABLE_INDEX);

    List<String> propNames = new ArrayList<>();
    for (int i = 0; i < NUM_CUSTOM_PROPERTIES; i++) {
      String propName = ns.prefix("fieldLimitProp_" + i);
      addCustomProperty(client, propName);
      propNames.add(propName);
      createdCustomPropertyNames.add(propName);
    }

    Table table = createTestTable(ns, "field_limit_test");

    Map<String, Object> extension = new HashMap<>();
    for (String propName : propNames) {
      extension.put(propName, "test_value_for_" + propName);
    }
    updateTableExtension(client, table.getId().toString(), extension);

    Thread.sleep(2000);

    int finalFieldCount = getFieldCount(searchClient, TABLE_INDEX);

    int fieldIncrease = finalFieldCount - initialFieldCount;
    assertTrue(
        fieldIncrease < NUM_CUSTOM_PROPERTIES,
        "Field count should not increase by number of custom properties. "
            + "Initial: "
            + initialFieldCount
            + ", Final: "
            + finalFieldCount
            + ", Increase: "
            + fieldIncrease
            + ". With flattened extension type, increase should be minimal.");
  }

  /**
   * Test that field count stays bounded even with multiple tables having different custom properties.
   */
  @Test
  void testFieldCountStaysBoundedWithMultipleTables(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    int initialFieldCount = getFieldCount(searchClient, TABLE_INDEX);

    for (int tableNum = 0; tableNum < 3; tableNum++) {
      String propName = ns.prefix("boundedProp_" + tableNum);
      addCustomProperty(client, propName);
      createdCustomPropertyNames.add(propName);

      Table table = createTestTable(ns, "bounded_test_" + tableNum);

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "value_" + tableNum);
      updateTableExtension(client, table.getId().toString(), extension);
    }

    Thread.sleep(2000);

    int finalFieldCount = getFieldCount(searchClient, TABLE_INDEX);

    int fieldIncrease = finalFieldCount - initialFieldCount;
    assertTrue(
        fieldIncrease < 10,
        "Field count should stay bounded. Initial: "
            + initialFieldCount
            + ", Final: "
            + finalFieldCount
            + ", Increase: "
            + fieldIncrease);
  }

  /**
   * Test that complex custom property types (entityReference, timeInterval, etc.)
   * are properly handled by the flattened extension and don't cause field explosion.
   */
  @Test
  void testComplexCustomPropertyTypesDoNotExplodeFieldCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Rest5Client searchClient = TestSuiteBootstrap.createSearchClient();

    int initialFieldCount = getFieldCount(searchClient, TABLE_INDEX);

    String stringPropName = ns.prefix("stringProp");
    String intPropName = ns.prefix("intProp");
    String entityRefPropName = ns.prefix("entityRefProp");
    String timeIntervalPropName = ns.prefix("timeIntervalProp");

    addCustomProperty(client, stringPropName, STRING_TYPE, null);
    createdCustomPropertyNames.add(stringPropName);

    addCustomProperty(client, intPropName, INTEGER_TYPE, null);
    createdCustomPropertyNames.add(intPropName);

    CustomPropertyConfig entityRefConfig = new CustomPropertyConfig();
    entityRefConfig.setConfig(List.of("user"));
    addCustomProperty(client, entityRefPropName, ENTITY_REFERENCE_TYPE, entityRefConfig);
    createdCustomPropertyNames.add(entityRefPropName);

    addCustomProperty(client, timeIntervalPropName, TIME_INTERVAL_TYPE, null);
    createdCustomPropertyNames.add(timeIntervalPropName);

    Table table = createTestTable(ns, "complex_props_test");

    Map<String, Object> extension = new HashMap<>();

    extension.put(stringPropName, "simple string value");

    extension.put(intPropName, 42);

    Map<String, Object> entityRef = new HashMap<>();
    entityRef.put("type", "user");
    entityRef.put("fullyQualifiedName", "admin");
    extension.put(entityRefPropName, entityRef);

    Map<String, Object> timeInterval = new HashMap<>();
    timeInterval.put("start", System.currentTimeMillis());
    timeInterval.put("end", System.currentTimeMillis() + 86400000L);
    extension.put(timeIntervalPropName, timeInterval);

    updateTableExtension(client, table.getId().toString(), extension);

    Thread.sleep(2000);

    int finalFieldCount = getFieldCount(searchClient, TABLE_INDEX);

    int fieldIncrease = finalFieldCount - initialFieldCount;
    assertTrue(
        fieldIncrease < 10,
        "Complex custom property types should not cause field explosion. "
            + "Initial: "
            + initialFieldCount
            + ", Final: "
            + finalFieldCount
            + ", Increase: "
            + fieldIncrease
            + ". Each complex type should be stored in flattened field, not as separate fields.");
  }

  /**
   * Test that attaching values to custom properties of different types works correctly
   * and the values are stored properly in the table's extension field.
   */
  @Test
  void testAttachDifferentCustomPropertyTypesToTable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String stringPropName = ns.prefix("attachStrProp");
    String intPropName = ns.prefix("attachIntProp");
    String entityRefPropName = ns.prefix("attachRefProp");
    String timeIntervalPropName = ns.prefix("attachTimeProp");

    addCustomProperty(client, stringPropName, STRING_TYPE, null);
    createdCustomPropertyNames.add(stringPropName);

    addCustomProperty(client, intPropName, INTEGER_TYPE, null);
    createdCustomPropertyNames.add(intPropName);

    CustomPropertyConfig entityRefConfig = new CustomPropertyConfig();
    entityRefConfig.setConfig(List.of("user"));
    addCustomProperty(client, entityRefPropName, ENTITY_REFERENCE_TYPE, entityRefConfig);
    createdCustomPropertyNames.add(entityRefPropName);

    addCustomProperty(client, timeIntervalPropName, TIME_INTERVAL_TYPE, null);
    createdCustomPropertyNames.add(timeIntervalPropName);

    Table table = createTestTable(ns, "attach_props_test");

    Map<String, Object> extension = new HashMap<>();
    extension.put(stringPropName, "test string value");
    extension.put(intPropName, 12345);

    Map<String, Object> entityRef = new HashMap<>();
    entityRef.put("type", "user");
    entityRef.put("fullyQualifiedName", "admin");
    extension.put(entityRefPropName, entityRef);

    Map<String, Object> timeInterval = new HashMap<>();
    long startTime = System.currentTimeMillis();
    long endTime = startTime + 86400000L;
    timeInterval.put("start", startTime);
    timeInterval.put("end", endTime);
    extension.put(timeIntervalPropName, timeInterval);

    updateTableExtension(client, table.getId().toString(), extension);

    String tableResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/tables/" + table.getId() + "?fields=extension", null);

    JsonNode tableJson = OBJECT_MAPPER.readTree(tableResponse);
    JsonNode extensionNode = tableJson.path("extension");

    assertFalse(extensionNode.isMissingNode(), "Extension should exist on table");
    assertEquals(
        "test string value",
        extensionNode.path(stringPropName).asText(),
        "String property value should match");
    assertEquals(
        12345, extensionNode.path(intPropName).asInt(), "Integer property value should match");

    JsonNode entityRefNode = extensionNode.path(entityRefPropName);
    assertFalse(entityRefNode.isMissingNode(), "EntityReference property should exist");
    assertEquals("user", entityRefNode.path("type").asText(), "EntityReference type should match");
    assertEquals(
        "admin",
        entityRefNode.path("fullyQualifiedName").asText(),
        "EntityReference FQN should match");

    JsonNode timeIntervalNode = extensionNode.path(timeIntervalPropName);
    assertFalse(timeIntervalNode.isMissingNode(), "TimeInterval property should exist");
    assertEquals(
        startTime, timeIntervalNode.path("start").asLong(), "TimeInterval start should match");
    assertEquals(endTime, timeIntervalNode.path("end").asLong(), "TimeInterval end should match");
  }

  private Table createTestTable(TestNamespace ns, String baseName) {
    initializeSharedDbEntities(ns);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(sharedSchema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private synchronized void initializeSharedDbEntities(TestNamespace ns) {
    if (sharedDbService != null) {
      return;
    }
    String shortId = ns.shortPrefix();

    var conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    sharedDbService =
        DatabaseServices.builder()
            .name("field_limit_svc_" + shortId)
            .connection(conn)
            .description("Test service for field limit")
            .create();

    var dbReq = new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("field_limit_db_" + shortId);
    dbReq.setService(sharedDbService.getFullyQualifiedName());
    sharedDatabase = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("field_limit_schema_" + shortId);
    schemaReq.setDatabase(sharedDatabase.getFullyQualifiedName());
    sharedSchema = SdkClients.adminClient().databaseSchemas().create(schemaReq);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private void addCustomProperty(OpenMetadataClient client, String propertyName) throws Exception {
    addCustomProperty(client, propertyName, STRING_TYPE, null);
  }

  private void addCustomProperty(
      OpenMetadataClient client,
      String propertyName,
      Type propertyType,
      CustomPropertyConfig config)
      throws Exception {
    Type tableType =
        OBJECT_MAPPER.readValue(
            client
                .getHttpClient()
                .executeForString(
                    HttpMethod.GET,
                    "/v1/metadata/types/name/" + TABLE_TYPE_NAME + "?fields=customProperties",
                    null),
            Type.class);

    CustomProperty customProperty =
        new CustomProperty()
            .withName(propertyName)
            .withDescription("Test custom property for field limit: " + propertyName)
            .withPropertyType(propertyType.getEntityReference());

    if (config != null) {
      customProperty.withCustomPropertyConfig(config);
    }

    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metadata/types/" + tableType.getId().toString(),
            customProperty,
            Type.class);
  }

  private static void deleteCustomProperty(OpenMetadataClient client, String propertyName) {
    try {
      Type tableType =
          OBJECT_MAPPER.readValue(
              client
                  .getHttpClient()
                  .executeForString(
                      HttpMethod.GET,
                      "/v1/metadata/types/name/" + TABLE_TYPE_NAME + "?fields=customProperties",
                      null),
              Type.class);

      client
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              "/v1/metadata/types/" + tableType.getId().toString() + "/" + propertyName,
              null,
              Void.class);
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void updateTableExtension(
      OpenMetadataClient client, String tableId, Map<String, Object> extension) throws Exception {
    String patchJson =
        OBJECT_MAPPER.writeValueAsString(
            List.of(Map.of("op", "add", "path", "/extension", "value", extension)));

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/tables/" + tableId,
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private int getFieldCount(Rest5Client searchClient, String indexName) throws Exception {
    Request request = new Request("GET", "/" + indexName + "/_mapping");
    Response response = searchClient.performRequest(request);

    String responseBody =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = OBJECT_MAPPER.readTree(responseBody);

    return countFields(root);
  }

  private int countFields(JsonNode node) {
    int count = 0;
    if (node.isObject()) {
      if (node.has("properties")) {
        JsonNode properties = node.get("properties");
        Iterator<String> fieldNames = properties.fieldNames();
        while (fieldNames.hasNext()) {
          count++;
          String fieldName = fieldNames.next();
          count += countFields(properties.get(fieldName));
        }
      }
      if (node.has("fields")) {
        JsonNode fields = node.get("fields");
        Iterator<String> fieldNames = fields.fieldNames();
        while (fieldNames.hasNext()) {
          count++;
          fieldNames.next();
        }
      }
    }
    return count;
  }

  private JsonNode findExtensionMapping(JsonNode root) {
    Iterator<JsonNode> indices = root.elements();
    while (indices.hasNext()) {
      JsonNode index = indices.next();
      JsonNode properties = index.path("mappings").path("properties");
      if (properties.has("extension")) {
        return properties.get("extension");
      }
    }
    return null;
  }

  private JsonNode findFieldMapping(JsonNode root, String fieldName) {
    Iterator<JsonNode> indices = root.elements();
    while (indices.hasNext()) {
      JsonNode index = indices.next();
      JsonNode properties = index.path("mappings").path("properties");
      if (properties.has(fieldName)) {
        return properties.get(fieldName);
      }
    }
    return null;
  }
}
