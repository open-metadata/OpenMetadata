package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.resources.system.SearchSettingsHandler;

class CustomPropertySearchTest {

  private SearchSettingsHandler searchSettingsHandler;

  @BeforeEach
  void setUp() {
    SearchSettings searchSettings = new SearchSettings();
    searchSettingsHandler = new SearchSettingsHandler();

    GlobalSettings globalSettings = new GlobalSettings();
    globalSettings.setMaxResultHits(10000);
    globalSettings.setMaxAggregateSize(10000);
    searchSettings.setGlobalSettings(globalSettings);
  }

  @Test
  void testValidExtensionFieldFormat() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.businessImportance", 5.0, "standard"));
    fields.add(createFieldBoost("extension.dataClassification", 3.0, "exact"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Valid extension fields should not throw exception");
  }

  @Test
  void testInvalidExtensionFieldFormat_MissingPropertyName() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.", 5.0, "standard"));
    tableConfig.setSearchFields(fields);

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
            "Extension field without property name should throw exception");

    assertTrue(
        exception.getMessage().contains("Invalid extension field format"),
        "Exception should mention invalid format");
  }

  @Test
  void testInvalidExtensionFieldFormat_NoPrefix() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("businessImportance", 5.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Regular fields without extension prefix should be allowed");
  }

  @Test
  void testDuplicateExtensionFields() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("extension.businessImportance", 5.0, "standard"));
    fields.add(createFieldBoost("extension.businessImportance", 10.0, "exact"));
    tableConfig.setSearchFields(fields);

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
            "Duplicate extension fields should throw exception");

    assertTrue(
        exception.getMessage().contains("Duplicate field configuration"),
        "Exception should mention duplicate field");
  }

  @Test
  void testMixedRegularAndExtensionFields() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("displayName", 8.0, "phrase"));
    fields.add(createFieldBoost("description", 5.0, "standard"));
    fields.add(createFieldBoost("extension.businessImportance", 7.0, "exact"));
    fields.add(createFieldBoost("extension.dataOwner", 4.0, "standard"));
    fields.add(createFieldBoost("extension.piiLevel", 6.0, "exact"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Mixed regular and extension fields should be valid");
  }

  @Test
  void testValidationWithStringCustomProperty() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.businessImportance", 5.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Configuration with string custom property should be valid");
  }

  @Test
  void testValidationWithMultipleCustomProperties() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("displayName", 8.0, "phrase"));
    fields.add(createFieldBoost("extension.businessImportance", 7.0, "exact"));
    fields.add(createFieldBoost("extension.dataClassification", 6.0, "phrase"));
    fields.add(createFieldBoost("extension.qualityScore", 4.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Configuration with multiple custom properties should be valid");
  }

  @Test
  void testValidationWithDifferentMatchTypes() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("extension.exactMatch", 10.0, "exact"));
    fields.add(createFieldBoost("extension.phraseMatch", 8.0, "phrase"));
    fields.add(createFieldBoost("extension.fuzzyMatch", 5.0, "fuzzy"));
    fields.add(createFieldBoost("extension.standardMatch", 7.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Custom properties with different match types should be valid");
  }

  @Test
  void testValidationWithHighBoost() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.criticalField", 100.0, "exact"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Custom property with high boost value should be valid");
  }

  @Test
  void testCustomPropertyWithZeroBoost() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.lowPriority", 0.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Custom property with zero boost should be valid");
  }

  @Test
  void testNestedExtensionFieldFormat() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.metadata.source", 5.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Nested custom property path should be valid");
  }

  @Test
  void testMultipleEntityTypesWithDifferentCustomProperties() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");
    List<FieldBoost> tableFields = new ArrayList<>();
    tableFields.add(createFieldBoost("name", 10.0, "phrase"));
    tableFields.add(createFieldBoost("extension.tableSpecificProperty", 5.0, "standard"));
    tableConfig.setSearchFields(tableFields);

    AssetTypeConfiguration topicConfig = new AssetTypeConfiguration();
    topicConfig.setAssetType("topic");
    List<FieldBoost> topicFields = new ArrayList<>();
    topicFields.add(createFieldBoost("name", 10.0, "phrase"));
    topicFields.add(createFieldBoost("extension.topicSpecificProperty", 7.0, "exact"));
    topicConfig.setSearchFields(topicFields);

    List<AssetTypeConfiguration> assetConfigs = new ArrayList<>();
    assetConfigs.add(tableConfig);
    assetConfigs.add(topicConfig);

    assertDoesNotThrow(
        () -> {
          searchSettingsHandler.validateAssetTypeConfiguration(tableConfig);
          searchSettingsHandler.validateAssetTypeConfiguration(topicConfig);
        },
        "Different entity types should have independent custom properties");
  }

  @Test
  void testEmptyExtensionFieldList() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Configuration without extension fields should be valid");
  }

  @Test
  void testOnlyExtensionFields() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("extension.property1", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.property2", 8.0, "exact"));
    fields.add(createFieldBoost("extension.property3", 5.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Configuration with only extension fields should be valid");
  }

  @Test
  void testExtensionFieldWithSpecialCharactersInName() {
    AssetTypeConfiguration tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");

    List<FieldBoost> fields = new ArrayList<>();
    fields.add(createFieldBoost("name", 10.0, "phrase"));
    fields.add(createFieldBoost("extension.property_with_underscore", 5.0, "standard"));
    fields.add(createFieldBoost("extension.propertyWithCamelCase", 4.0, "standard"));
    tableConfig.setSearchFields(fields);

    assertDoesNotThrow(
        () -> searchSettingsHandler.validateAssetTypeConfiguration(tableConfig),
        "Extension fields with underscores and camelCase should be valid");
  }

  @Test
  void testSearchSettingsMergePreservesExtensionFields() {
    SearchSettings defaultSettings = new SearchSettings();
    GlobalSettings defaultGlobal = new GlobalSettings();
    defaultGlobal.setMaxResultHits(5000);
    defaultSettings.setGlobalSettings(defaultGlobal);

    AssetTypeConfiguration defaultTableConfig = new AssetTypeConfiguration();
    defaultTableConfig.setAssetType("table");
    List<FieldBoost> defaultFields = new ArrayList<>();
    defaultFields.add(createFieldBoost("name", 10.0, "phrase"));
    defaultTableConfig.setSearchFields(defaultFields);

    List<AssetTypeConfiguration> defaultAssetConfigs = new ArrayList<>();
    defaultAssetConfigs.add(defaultTableConfig);
    defaultSettings.setAssetTypeConfigurations(defaultAssetConfigs);

    SearchSettings incomingSettings = new SearchSettings();
    GlobalSettings incomingGlobal = new GlobalSettings();
    incomingGlobal.setMaxResultHits(8000);
    incomingSettings.setGlobalSettings(incomingGlobal);

    AssetTypeConfiguration incomingTableConfig = new AssetTypeConfiguration();
    incomingTableConfig.setAssetType("table");
    List<FieldBoost> incomingFields = new ArrayList<>();
    incomingFields.add(createFieldBoost("name", 10.0, "phrase"));
    incomingFields.add(createFieldBoost("extension.customProperty", 5.0, "standard"));
    incomingTableConfig.setSearchFields(incomingFields);

    List<AssetTypeConfiguration> incomingAssetConfigs = new ArrayList<>();
    incomingAssetConfigs.add(incomingTableConfig);
    incomingSettings.setAssetTypeConfigurations(incomingAssetConfigs);

    SearchSettings merged =
        searchSettingsHandler.mergeSearchSettings(defaultSettings, incomingSettings);

    assertNotNull(merged, "Merged settings should not be null");
    assertNotNull(
        merged.getAssetTypeConfigurations(), "Asset type configurations should not be null");

    AssetTypeConfiguration mergedTableConfig =
        merged.getAssetTypeConfigurations().stream()
            .filter(config -> "table".equals(config.getAssetType()))
            .findFirst()
            .orElse(null);

    assertNotNull(mergedTableConfig, "Table configuration should exist in merged settings");
    assertNotNull(mergedTableConfig.getSearchFields(), "Search fields should not be null");

    boolean hasExtensionField =
        mergedTableConfig.getSearchFields().stream()
            .anyMatch(field -> field.getField().startsWith("extension."));

    assertTrue(hasExtensionField, "Merged settings should preserve extension fields");
  }

  private FieldBoost createFieldBoost(String field, Double boost, String matchType) {
    FieldBoost fieldBoost = new FieldBoost();
    fieldBoost.setField(field);
    fieldBoost.setBoost(boost);
    if (matchType != null) {
      fieldBoost.setMatchType(FieldBoost.MatchType.fromValue(matchType));
    }
    return fieldBoost;
  }
}
