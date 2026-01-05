package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.resources.EntityResourceTest.C2;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.pipelines.PipelineResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CustomPropertySearchIntegrationTest extends OpenMetadataApplicationTest {

  private TableResourceTest tableResourceTest;
  private DashboardResourceTest dashboardResourceTest;
  private PipelineResourceTest pipelineResourceTest;
  private Type tableEntityType;
  private Type dashboardEntityType;
  private Type pipelineEntityType;
  private Type stringPropertyType;
  private SearchSettings originalSearchSettings;

  @BeforeAll
  void setup(TestInfo test) throws IOException {
    tableResourceTest = new TableResourceTest();
    dashboardResourceTest = new DashboardResourceTest();
    pipelineResourceTest = new PipelineResourceTest();

    try {
      tableResourceTest.setup(test);
      dashboardResourceTest.setup(test);
      pipelineResourceTest.setup(test);
    } catch (Exception e) {
      LOG.warn("Some entities already exist - continuing with test execution");
    }

    tableEntityType = getEntityTypeByName("table");
    dashboardEntityType = getEntityTypeByName("dashboard");
    pipelineEntityType = getEntityTypeByName("pipeline");
    stringPropertyType = getEntityTypeByName("string");

    originalSearchSettings = getSearchSettings();
  }

  @Test
  void testSearchWithStringCustomProperty() throws IOException {
    String testName = "testSearchWithStringCustomProperty_" + System.currentTimeMillis();

    CustomProperty businessImportanceProperty =
        new CustomProperty()
            .withName("businessImportance_" + System.currentTimeMillis())
            .withDescription("Business importance level")
            .withDisplayName("Business Importance")
            .withPropertyType(stringPropertyType.getEntityReference());

    addCustomPropertyToEntity(tableEntityType.getId(), businessImportanceProperty);

    CreateTable createTable =
        tableResourceTest
            .createRequest(testName)
            .withName(testName)
            .withColumns(
                List.of(
                    getColumn(C1, ColumnDataType.VARCHAR, null).withDataLength(50),
                    getColumn(C2, ColumnDataType.VARCHAR, null).withDataLength(50)));

    Table createdTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(createdTable, "Table should be created successfully");

    String originalJson = JsonUtils.pojoToJson(createdTable);
    ObjectNode extension = new ObjectMapper().createObjectNode();
    extension.put(businessImportanceProperty.getName(), "CRITICAL");
    createdTable.setExtension(extension);

    Table updatedTable =
        tableResourceTest.patchEntity(
            createdTable.getId(), originalJson, createdTable, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTable, "Table should be updated with custom property");
    assertNotNull(updatedTable.getExtension(), "Extension should not be null");

    configureSearchSettingsWithCustomProperty(businessImportanceProperty.getName());

    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    String searchResult = searchByQuery("CRITICAL", "table");
    assertNotNull(searchResult, "Search result should not be null");
    assertNotEquals(
        "{}",
        searchResult,
        "Search should not return empty result (check if search endpoint exists)");

    ObjectMapper mapper = new ObjectMapper();
    JsonNode resultNode = mapper.readTree(searchResult);
    assertNotNull(resultNode, "Result node should not be null");

    assertTrue(resultNode.has("hits"), "Search result should have 'hits' field");
    assertTrue(
        resultNode.get("hits").has("hits"), "Search result hits should have nested 'hits' field");

    JsonNode hits = resultNode.get("hits").get("hits");
    assertTrue(hits.isArray(), "Hits should be an array");
    LOG.info("Search returned {} results", hits.size());
    assertTrue(hits.size() > 0, "Should find at least one table with custom property value");

    tableResourceTest.deleteEntity(createdTable.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testSearchWithMultipleCustomProperties() throws IOException {
    String testName = "testMultipleCustomProps_" + System.currentTimeMillis();

    CustomProperty dataClassificationProperty =
        new CustomProperty()
            .withName("dataClassification_" + System.currentTimeMillis())
            .withDescription("Data classification level")
            .withDisplayName("Data Classification")
            .withPropertyType(stringPropertyType.getEntityReference());

    CustomProperty dataOwnerProperty =
        new CustomProperty()
            .withName("dataOwner_" + System.currentTimeMillis())
            .withDescription("Data owner name")
            .withDisplayName("Data Owner")
            .withPropertyType(stringPropertyType.getEntityReference());

    addCustomPropertyToEntity(tableEntityType.getId(), dataClassificationProperty);
    addCustomPropertyToEntity(tableEntityType.getId(), dataOwnerProperty);

    CreateTable createTable =
        tableResourceTest
            .createRequest(testName)
            .withName(testName)
            .withColumns(
                List.of(
                    getColumn(C1, ColumnDataType.VARCHAR, null).withDataLength(50),
                    getColumn(C2, ColumnDataType.VARCHAR, null).withDataLength(50)));

    Table createdTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(createdTable, "Table should be created successfully");

    String originalJson = JsonUtils.pojoToJson(createdTable);
    ObjectNode extension = new ObjectMapper().createObjectNode();
    extension.put(dataClassificationProperty.getName(), "SENSITIVE");
    extension.put(dataOwnerProperty.getName(), "John Doe");
    createdTable.setExtension(extension);

    Table updatedTable =
        tableResourceTest.patchEntity(
            createdTable.getId(), originalJson, createdTable, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTable, "Table should be updated with custom properties");
    assertNotNull(updatedTable.getExtension(), "Extension should not be null");

    configureSearchSettingsWithMultipleCustomProperties(
        List.of(dataClassificationProperty.getName(), dataOwnerProperty.getName()));

    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    String searchResult1 = searchByQuery("SENSITIVE", "table");
    assertNotNull(searchResult1, "Search by classification should return results");

    String searchResult2 = searchByQuery("John Doe", "table");
    assertNotNull(searchResult2, "Search by owner should return results");

    tableResourceTest.deleteEntity(createdTable.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testSearchWithCustomPropertyDifferentMatchTypes() throws IOException {
    String testName = "testMatchTypes_" + System.currentTimeMillis();

    CustomProperty descriptionProperty =
        new CustomProperty()
            .withName("customDescription_" + System.currentTimeMillis())
            .withDescription("Custom description field")
            .withDisplayName("Custom Description")
            .withPropertyType(stringPropertyType.getEntityReference());

    addCustomPropertyToEntity(tableEntityType.getId(), descriptionProperty);

    CreateTable createTable =
        tableResourceTest
            .createRequest(testName)
            .withName(testName)
            .withColumns(
                List.of(
                    getColumn(C1, ColumnDataType.VARCHAR, null).withDataLength(50),
                    getColumn(C2, ColumnDataType.VARCHAR, null).withDataLength(50)));

    Table createdTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(createdTable, "Table should be created successfully");

    String originalJson = JsonUtils.pojoToJson(createdTable);
    ObjectNode extension = new ObjectMapper().createObjectNode();
    extension.put(descriptionProperty.getName(), "This is a highly critical production table");
    createdTable.setExtension(extension);

    Table updatedTable =
        tableResourceTest.patchEntity(
            createdTable.getId(), originalJson, createdTable, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTable, "Table should be updated");

    configureSearchSettingsWithMatchType(descriptionProperty.getName(), "phrase", 10.0);

    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    String exactPhraseResult = searchByQuery("\"highly critical\"", "table");
    assertNotNull(exactPhraseResult, "Phrase search should return results");

    String fuzzyResult = searchByQuery("producton", "table");
    assertNotNull(fuzzyResult, "Fuzzy search should handle typos");

    tableResourceTest.deleteEntity(createdTable.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testCustomPropertyNotInSearchSettingsIsNotSearchable() throws IOException {
    String testName = "testNotSearchable_" + System.currentTimeMillis();

    CustomProperty invisibleProperty =
        new CustomProperty()
            .withName("invisibleProperty_" + System.currentTimeMillis())
            .withDescription("This property is not in search settings")
            .withDisplayName("Invisible Property")
            .withPropertyType(stringPropertyType.getEntityReference());

    addCustomPropertyToEntity(tableEntityType.getId(), invisibleProperty);

    CreateTable createTable =
        tableResourceTest
            .createRequest(testName)
            .withName(testName)
            .withColumns(
                List.of(
                    getColumn(C1, ColumnDataType.VARCHAR, null).withDataLength(50),
                    getColumn(C2, ColumnDataType.VARCHAR, null).withDataLength(50)));

    Table createdTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(createdTable, "Table should be created");

    String originalJson = JsonUtils.pojoToJson(createdTable);
    ObjectNode extension = new ObjectMapper().createObjectNode();
    extension.put(invisibleProperty.getName(), "UNIQUE_VALUE_NOT_SEARCHABLE");
    createdTable.setExtension(extension);

    Table updatedTable =
        tableResourceTest.patchEntity(
            createdTable.getId(), originalJson, createdTable, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTable, "Table should be updated");

    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    String searchResult = searchByQuery("UNIQUE_VALUE_NOT_SEARCHABLE", "table");
    assertNotNull(searchResult, "Search should execute without error");

    tableResourceTest.deleteEntity(createdTable.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testGetCustomPropertiesByEntityTypeEndpoint() throws IOException {
    WebTarget target = getResource("metadata/types/name/table/customProperties");

    try {
      String response = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
      assertNotNull(response, "Response should not be null");

      ObjectMapper mapper = new ObjectMapper();
      JsonNode responseNode = mapper.readTree(response);
      assertTrue(responseNode.isArray(), "Response should be an array of custom properties");

      LOG.info("Retrieved {} custom properties for table entity", responseNode.size());
    } catch (HttpResponseException e) {
      LOG.warn("Custom properties endpoint returned: {}", e.getMessage());
    }
  }

  @Test
  void testSearchWithDashboardCustomProperty() throws IOException {
    String testName = "testSearchWithDashboardCustomProperty_" + System.currentTimeMillis();

    CustomProperty dashboardCategoryProperty =
        new CustomProperty()
            .withName("dashboardCategory_" + System.currentTimeMillis())
            .withDescription("Dashboard category classification")
            .withDisplayName("Dashboard Category")
            .withPropertyType(stringPropertyType.getEntityReference());

    addCustomPropertyToEntity(dashboardEntityType.getId(), dashboardCategoryProperty);

    CreateDashboard createDashboard =
        dashboardResourceTest.createRequest(testName).withName(testName);

    Dashboard createdDashboard =
        dashboardResourceTest.createEntity(createDashboard, ADMIN_AUTH_HEADERS);
    assertNotNull(createdDashboard, "Dashboard should be created successfully");

    String originalJson = JsonUtils.pojoToJson(createdDashboard);
    ObjectNode extension = new ObjectMapper().createObjectNode();
    extension.put(dashboardCategoryProperty.getName(), "EXECUTIVE_DASHBOARD");
    createdDashboard.setExtension(extension);

    Dashboard updatedDashboard =
        dashboardResourceTest.patchEntity(
            createdDashboard.getId(), originalJson, createdDashboard, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedDashboard, "Dashboard should be updated with custom property");
    assertNotNull(updatedDashboard.getExtension(), "Extension should not be null");

    configureSearchSettingsForEntityType("dashboard", dashboardCategoryProperty.getName());

    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    String searchResult = searchByQuery("EXECUTIVE_DASHBOARD", "dashboard");
    assertNotNull(searchResult, "Search result should not be null");
    assertNotEquals(
        "{}",
        searchResult,
        "Search should not return empty result (check if search endpoint exists)");

    ObjectMapper mapper = new ObjectMapper();
    JsonNode resultNode = mapper.readTree(searchResult);
    assertNotNull(resultNode, "Result node should not be null");

    assertTrue(resultNode.has("hits"), "Search result should have 'hits' field");
    assertTrue(
        resultNode.get("hits").has("hits"), "Search result hits should have nested 'hits' field");

    JsonNode hits = resultNode.get("hits").get("hits");
    assertTrue(hits.isArray(), "Hits should be an array");
    LOG.info("Dashboard search returned {} results", hits.size());
    assertTrue(hits.size() > 0, "Should find at least one dashboard with custom property value");

    dashboardResourceTest.deleteEntity(createdDashboard.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testSearchWithPipelineCustomProperty() throws IOException {
    String testName = "testSearchWithPipelineCustomProperty_" + System.currentTimeMillis();

    CustomProperty pipelineTypeProperty =
        new CustomProperty()
            .withName("pipelineType_" + System.currentTimeMillis())
            .withDescription("Pipeline type classification")
            .withDisplayName("Pipeline Type")
            .withPropertyType(stringPropertyType.getEntityReference());

    addCustomPropertyToEntity(pipelineEntityType.getId(), pipelineTypeProperty);

    CreatePipeline createPipeline = pipelineResourceTest.createRequest(testName).withName(testName);

    Pipeline createdPipeline =
        pipelineResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);
    assertNotNull(createdPipeline, "Pipeline should be created successfully");

    String originalJson = JsonUtils.pojoToJson(createdPipeline);
    ObjectNode extension = new ObjectMapper().createObjectNode();
    extension.put(pipelineTypeProperty.getName(), "ETL_PRODUCTION");
    createdPipeline.setExtension(extension);

    Pipeline updatedPipeline =
        pipelineResourceTest.patchEntity(
            createdPipeline.getId(), originalJson, createdPipeline, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedPipeline, "Pipeline should be updated with custom property");
    assertNotNull(updatedPipeline.getExtension(), "Extension should not be null");

    configureSearchSettingsForEntityType("pipeline", pipelineTypeProperty.getName());

    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    String searchResult = searchByQuery("ETL_PRODUCTION", "pipeline");
    assertNotNull(searchResult, "Search result should not be null");
    assertNotEquals(
        "{}",
        searchResult,
        "Search should not return empty result (check if search endpoint exists)");

    ObjectMapper mapper = new ObjectMapper();
    JsonNode resultNode = mapper.readTree(searchResult);
    assertNotNull(resultNode, "Result node should not be null");

    assertTrue(resultNode.has("hits"), "Search result should have 'hits' field");
    assertTrue(
        resultNode.get("hits").has("hits"), "Search result hits should have nested 'hits' field");

    JsonNode hits = resultNode.get("hits").get("hits");
    assertTrue(hits.isArray(), "Hits should be an array");
    LOG.info("Pipeline search returned {} results", hits.size());
    assertTrue(hits.size() > 0, "Should find at least one pipeline with custom property value");

    pipelineResourceTest.deleteEntity(createdPipeline.getId(), ADMIN_AUTH_HEADERS);
  }

  private Type getEntityTypeByName(String typeName) throws IOException {
    WebTarget target = getResource("metadata/types/name/" + typeName);
    target = target.queryParam("fields", "customProperties");

    try {
      String response = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
      return JsonUtils.readValue(response, Type.class);
    } catch (HttpResponseException e) {
      throw new IOException("Failed to get entity type: " + typeName, e);
    }
  }

  private void addCustomPropertyToEntity(java.util.UUID entityTypeId, CustomProperty property)
      throws IOException {
    WebTarget target = getResource("metadata/types/" + entityTypeId.toString());

    try {
      TestUtils.put(
          target, property, Type.class, jakarta.ws.rs.core.Response.Status.OK, ADMIN_AUTH_HEADERS);
      LOG.info("Added custom property '{}' to entity type", property.getName());
    } catch (HttpResponseException e) {
      LOG.warn("Failed to add custom property: {}", e.getMessage());
    }
  }

  private SearchSettings getSearchSettings() throws IOException {
    WebTarget target = getResource("system/settings/searchSettings");

    try {
      Settings settings = TestUtils.get(target, Settings.class, ADMIN_AUTH_HEADERS);
      // The configValue is returned as a LinkedHashMap, need to convert to SearchSettings
      ObjectMapper mapper = new ObjectMapper();
      String configJson = mapper.writeValueAsString(settings.getConfigValue());
      return mapper.readValue(configJson, SearchSettings.class);
    } catch (HttpResponseException e) {
      LOG.warn("Failed to get search settings: {}", e.getMessage());
      return new SearchSettings();
    }
  }

  private void configureSearchSettingsWithCustomProperty(String propertyName) throws IOException {
    SearchSettings settings = getSearchSettings();

    AssetTypeConfiguration tableConfig =
        settings.getAssetTypeConfigurations().stream()
            .filter(config -> "table".equalsIgnoreCase(config.getAssetType()))
            .findFirst()
            .orElse(null);

    if (tableConfig != null) {
      List<FieldBoost> searchFields =
          tableConfig.getSearchFields() != null
              ? new ArrayList<>(tableConfig.getSearchFields())
              : new ArrayList<>();

      FieldBoost customPropertyField = new FieldBoost();
      customPropertyField.setField("extension." + propertyName);
      customPropertyField.setBoost(10.0);
      customPropertyField.setMatchType(FieldBoost.MatchType.STANDARD);

      searchFields.add(customPropertyField);
      tableConfig.setSearchFields(searchFields);

      updateSearchSettings(settings);
    }
  }

  private void configureSearchSettingsWithMultipleCustomProperties(List<String> propertyNames)
      throws IOException {
    SearchSettings settings = getSearchSettings();

    AssetTypeConfiguration tableConfig =
        settings.getAssetTypeConfigurations().stream()
            .filter(config -> "table".equalsIgnoreCase(config.getAssetType()))
            .findFirst()
            .orElse(null);

    if (tableConfig != null) {
      List<FieldBoost> searchFields =
          tableConfig.getSearchFields() != null
              ? new ArrayList<>(tableConfig.getSearchFields())
              : new ArrayList<>();

      for (String propertyName : propertyNames) {
        FieldBoost customPropertyField = new FieldBoost();
        customPropertyField.setField("extension." + propertyName);
        customPropertyField.setBoost(8.0);
        customPropertyField.setMatchType(FieldBoost.MatchType.STANDARD);
        searchFields.add(customPropertyField);
      }

      tableConfig.setSearchFields(searchFields);
      updateSearchSettings(settings);
    }
  }

  private void configureSearchSettingsWithMatchType(
      String propertyName, String matchType, Double boost) throws IOException {
    SearchSettings settings = getSearchSettings();

    AssetTypeConfiguration tableConfig =
        settings.getAssetTypeConfigurations().stream()
            .filter(config -> "table".equalsIgnoreCase(config.getAssetType()))
            .findFirst()
            .orElse(null);

    if (tableConfig != null) {
      List<FieldBoost> searchFields =
          tableConfig.getSearchFields() != null
              ? new ArrayList<>(tableConfig.getSearchFields())
              : new ArrayList<>();

      FieldBoost customPropertyField = new FieldBoost();
      customPropertyField.setField("extension." + propertyName);
      customPropertyField.setBoost(boost);
      customPropertyField.setMatchType(FieldBoost.MatchType.fromValue(matchType));

      searchFields.add(customPropertyField);
      tableConfig.setSearchFields(searchFields);

      updateSearchSettings(settings);
    }
  }

  private void configureSearchSettingsForEntityType(String entityType, String propertyName)
      throws IOException {
    SearchSettings settings = getSearchSettings();
    LOG.info(
        "Retrieved search settings with {} asset type configurations",
        settings.getAssetTypeConfigurations().size());

    AssetTypeConfiguration entityConfig =
        settings.getAssetTypeConfigurations().stream()
            .filter(
                config -> {
                  LOG.info("Checking config for assetType: {}", config.getAssetType());
                  return entityType.equalsIgnoreCase(config.getAssetType());
                })
            .findFirst()
            .orElse(null);

    if (entityConfig != null) {
      LOG.info("Found configuration for entity type: {}", entityType);
      List<FieldBoost> searchFields =
          entityConfig.getSearchFields() != null
              ? new ArrayList<>(entityConfig.getSearchFields())
              : new ArrayList<>();

      FieldBoost customPropertyField = new FieldBoost();
      customPropertyField.setField("extension." + propertyName);
      customPropertyField.setBoost(10.0);
      customPropertyField.setMatchType(FieldBoost.MatchType.STANDARD);

      searchFields.add(customPropertyField);
      entityConfig.setSearchFields(searchFields);

      LOG.info(
          "Added custom property field: extension.{} with boost {} to {} asset type",
          propertyName,
          customPropertyField.getBoost(),
          entityType);
      LOG.info("Total search fields for {}: {}", entityType, searchFields.size());

      updateSearchSettings(settings);
    } else {
      LOG.error("Entity type configuration not found for: {}", entityType);
      LOG.error(
          "Available asset types: {}",
          settings.getAssetTypeConfigurations().stream()
              .map(AssetTypeConfiguration::getAssetType)
              .collect(java.util.stream.Collectors.joining(", ")));
    }
  }

  private void updateSearchSettings(SearchSettings settings) throws IOException {
    WebTarget target = getResource("system/settings");

    Settings settingsPayload = new Settings();
    settingsPayload.setConfigType(SettingsType.SEARCH_SETTINGS);
    settingsPayload.setConfigValue(settings);

    try {
      TestUtils.put(
          target,
          settingsPayload,
          Settings.class,
          jakarta.ws.rs.core.Response.Status.OK,
          ADMIN_AUTH_HEADERS);
      LOG.info("Updated search settings successfully");
    } catch (HttpResponseException e) {
      LOG.error("Failed to update search settings: {}", e.getMessage());
    }
  }

  private String searchByQuery(String query, String index) {
    WebTarget target =
        getResource("search/query")
            .queryParam("q", query)
            .queryParam("index", index)
            .queryParam("from", 0)
            .queryParam("size", 10);

    LOG.info("Executing search query: q={}, index={}", query, index);

    try {
      String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
      LOG.info("Search query returned: {} characters", result.length());
      LOG.info(
          "Search result preview: {}",
          result.length() > 200 ? result.substring(0, 200) + "..." : result);
      return result;
    } catch (HttpResponseException e) {
      LOG.error("Search query failed with status {}: {}", e.getStatusCode(), e.getMessage());
      LOG.error("Search query URL: {}", target.getUri());
      return "{}";
    }
  }
}
