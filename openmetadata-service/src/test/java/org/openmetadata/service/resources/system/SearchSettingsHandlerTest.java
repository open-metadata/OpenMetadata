package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Field;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

class SearchSettingsHandlerTest {

  private SearchSettingsHandler searchSettingsHandler;
  private SearchSettings defaultSearchSettings;

  @BeforeEach
  void setUp() throws IOException {
    searchSettingsHandler = new SearchSettingsHandler();
    defaultSearchSettings = loadDefaultSearchSettingsFromFile();
  }

  private SearchSettings loadDefaultSearchSettingsFromFile() throws IOException {
    List<String> jsonDataFiles =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(
            EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
    return JsonUtils.readValue(json, SearchSettings.class);
  }

  @Test
  void testDefaultSearchSettingsJsonContainsMetricAssetType() {
    AssetTypeConfiguration metricConfig = findAssetConfig(defaultSearchSettings, "metric");
    assertNotNull(metricConfig, "searchSettings.json must contain metric assetTypeConfiguration");
    assertNotNull(metricConfig.getSearchFields());
    assertFalse(
        metricConfig.getSearchFields().isEmpty(),
        "Metric config must have at least one search field");

    Set<String> fieldNames =
        metricConfig.getSearchFields().stream()
            .map(FieldBoost::getField)
            .collect(Collectors.toSet());
    assertTrue(fieldNames.contains("name"), "Metric config must include 'name' field");
    assertTrue(
        fieldNames.contains("displayName.keyword"),
        "Metric config must include 'displayName.keyword' field");
    assertTrue(
        fieldNames.contains("description"), "Metric config must include 'description' field");
  }

  @Test
  void testDefaultSearchSettingsJsonContainsMetricAllowedFields() {
    assertNotNull(defaultSearchSettings.getAllowedFields());
    AllowedSearchFields metricAllowed =
        defaultSearchSettings.getAllowedFields().stream()
            .filter(f -> "metric".equals(f.getEntityType()))
            .findFirst()
            .orElse(null);
    assertNotNull(metricAllowed, "searchSettings.json must contain metric in allowedFields");
    assertFalse(
        metricAllowed.getFields().isEmpty(), "Metric allowedFields must have at least one field");
  }

  @Test
  void testEveryAssetTypeHasCorrespondingAllowedFields() {
    Set<String> assetTypes =
        defaultSearchSettings.getAssetTypeConfigurations().stream()
            .map(AssetTypeConfiguration::getAssetType)
            .collect(Collectors.toSet());

    Set<String> allowedFieldEntityTypes =
        defaultSearchSettings.getAllowedFields().stream()
            .map(AllowedSearchFields::getEntityType)
            .collect(Collectors.toSet());

    for (String assetType : assetTypes) {
      assertTrue(
          allowedFieldEntityTypes.contains(assetType),
          "Asset type '" + assetType + "' has no corresponding allowedFields entry");
    }
  }

  @Test
  void testMergeAddsNewAssetTypeFromDefaults() {
    SearchSettings defaults = createBaseSettings(5000);
    defaults.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                createAssetConfig("table", "name", 10.0),
                createAssetConfig("metric", "name", 10.0))));

    SearchSettings existing = createBaseSettings(8000);
    existing.setAssetTypeConfigurations(
        new ArrayList<>(List.of(createAssetConfig("table", "name", 15.0))));

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    assertNotNull(
        findAssetConfig(merged, "metric"),
        "Metric asset type from defaults should be added to merged settings");
    assertEquals(
        15.0,
        findAssetConfig(merged, "table").getSearchFields().get(0).getBoost(),
        "Existing table config should preserve user-customized boost");
  }

  @Test
  void testMergeDoesNotDuplicateExistingAssetType() {
    SearchSettings defaults = createBaseSettings(5000);
    defaults.setAssetTypeConfigurations(
        new ArrayList<>(List.of(createAssetConfig("metric", "name", 10.0))));

    SearchSettings existing = createBaseSettings(8000);
    existing.setAssetTypeConfigurations(
        new ArrayList<>(List.of(createAssetConfig("metric", "name", 20.0))));

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    long metricCount =
        merged.getAssetTypeConfigurations().stream()
            .filter(config -> "metric".equals(config.getAssetType()))
            .count();
    assertEquals(1, metricCount, "Should not duplicate metric asset type");
    assertEquals(
        20.0,
        findAssetConfig(merged, "metric").getSearchFields().get(0).getBoost(),
        "Existing metric config should be preserved, not overwritten by defaults");
  }

  @Test
  void testMergeCaseInsensitiveAssetTypeMatching() {
    SearchSettings defaults = createBaseSettings(5000);
    defaults.setAssetTypeConfigurations(
        new ArrayList<>(List.of(createAssetConfig("Metric", "name", 10.0))));

    SearchSettings existing = createBaseSettings(8000);
    existing.setAssetTypeConfigurations(
        new ArrayList<>(List.of(createAssetConfig("metric", "name", 20.0))));

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    long count =
        merged.getAssetTypeConfigurations().stream()
            .filter(config -> config.getAssetType().equalsIgnoreCase("metric"))
            .count();
    assertEquals(1, count, "Case-insensitive match should prevent duplicates");
  }

  @Test
  void testMergeWithNullIncomingAssetTypeConfigurations() {
    SearchSettings defaults = createBaseSettings(5000);
    defaults.setAssetTypeConfigurations(
        new ArrayList<>(List.of(createAssetConfig("metric", "name", 10.0))));

    SearchSettings existing = createBaseSettings(8000);
    existing.setAssetTypeConfigurations(null);

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    assertNotNull(merged.getAssetTypeConfigurations());
    assertNotNull(
        findAssetConfig(merged, "metric"),
        "Metric should be added when incoming has null asset configurations");
  }

  @Test
  void testMergeWithNullIncomingReturnsDefaults() {
    SearchSettings defaults = createBaseSettings(5000);
    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, null);
    assertEquals(defaults, merged);
  }

  @Test
  void testMergeWithNullDefaultsThrows() {
    SearchSettings existing = createBaseSettings(8000);
    assertThrows(
        SystemSettingsException.class,
        () -> searchSettingsHandler.mergeSearchSettings(null, existing));
  }

  @Test
  void testMergeAlwaysOverwritesAllowedFieldsFromDefaults() {
    SearchSettings defaults = createBaseSettings(5000);
    defaults.setAssetTypeConfigurations(new ArrayList<>());

    Field nameField = new Field();
    nameField.setName("name");
    nameField.setDescription("Default description");

    AllowedSearchFields metricAllowed = new AllowedSearchFields();
    metricAllowed.setEntityType("metric");
    metricAllowed.setFields(List.of(nameField));
    defaults.setAllowedFields(List.of(metricAllowed));

    SearchSettings existing = createBaseSettings(8000);
    existing.setAssetTypeConfigurations(new ArrayList<>());

    Field customField = new Field();
    customField.setName("customField");
    customField.setDescription("User added field");

    AllowedSearchFields existingAllowed = new AllowedSearchFields();
    existingAllowed.setEntityType("metric");
    existingAllowed.setFields(List.of(customField));
    existing.setAllowedFields(List.of(existingAllowed));

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    AllowedSearchFields mergedMetric =
        merged.getAllowedFields().stream()
            .filter(f -> "metric".equals(f.getEntityType()))
            .findFirst()
            .orElse(null);
    assertNotNull(mergedMetric);
    assertEquals(1, mergedMetric.getFields().size());
    assertEquals(
        "name",
        mergedMetric.getFields().get(0).getName(),
        "Allowed fields should come from defaults, not from existing/incoming settings");
  }

  @Test
  void testMergeWithMultipleNewAndExistingAssetTypes() {
    SearchSettings defaults = createBaseSettings(5000);
    defaults.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                createAssetConfig("table", "name", 10.0),
                createAssetConfig("metric", "name", 10.0),
                createAssetConfig("dashboard", "name", 10.0),
                createAssetConfig("topic", "name", 10.0))));

    SearchSettings existing = createBaseSettings(8000);
    existing.setAssetTypeConfigurations(
        new ArrayList<>(
            List.of(
                createAssetConfig("table", "name", 15.0),
                createAssetConfig("dashboard", "name", 25.0))));

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    assertEquals(4, merged.getAssetTypeConfigurations().size());
    assertNotNull(findAssetConfig(merged, "metric"), "metric should be added from defaults");
    assertNotNull(findAssetConfig(merged, "topic"), "topic should be added from defaults");
    assertEquals(15.0, findAssetConfig(merged, "table").getSearchFields().get(0).getBoost());
    assertEquals(25.0, findAssetConfig(merged, "dashboard").getSearchFields().get(0).getBoost());
  }

  @Test
  void testMergePreservesDefaultConfigurationWhenIncomingIsNull() {
    SearchSettings defaults = createBaseSettings(5000);
    AssetTypeConfiguration defaultConfig = createAssetConfig("default", "name", 5.0);
    defaults.setDefaultConfiguration(defaultConfig);
    defaults.setAssetTypeConfigurations(new ArrayList<>());

    SearchSettings existing = createBaseSettings(8000);
    existing.setDefaultConfiguration(null);
    existing.setAssetTypeConfigurations(new ArrayList<>());

    SearchSettings merged = searchSettingsHandler.mergeSearchSettings(defaults, existing);

    assertNotNull(merged.getDefaultConfiguration());
    assertEquals("default", merged.getDefaultConfiguration().getAssetType());
  }

  private SearchSettings createBaseSettings(int maxResultHits) {
    SearchSettings settings = new SearchSettings();
    GlobalSettings global = new GlobalSettings();
    global.setMaxResultHits(maxResultHits);
    settings.setGlobalSettings(global);
    return settings;
  }

  private AssetTypeConfiguration createAssetConfig(
      String assetType, String fieldName, double boost) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType(assetType);
    config.setSearchFields(new ArrayList<>(List.of(createFieldBoost(fieldName, boost, "phrase"))));
    return config;
  }

  private AssetTypeConfiguration findAssetConfig(SearchSettings settings, String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(config -> assetType.equalsIgnoreCase(config.getAssetType()))
        .findFirst()
        .orElse(null);
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
