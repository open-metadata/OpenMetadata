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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Field;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingSignals;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.HighlightFieldClassifier;
import org.openmetadata.service.util.EntityUtil;

class SearchSettingsHandlerTest {

  private SearchSettingsHandler searchSettingsHandler;
  private SearchSettings defaultSearchSettings;

  @BeforeAll
  static void loadIndexMappings() throws IOException {
    // The highlight-field check classifies against the real index mappings; without this the
    // classifier cannot see any mapping and reports every field as supported.
    IndexMappingLoader.init();
  }

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
  void shippedDefaultHighlightFieldsAreAllHighlightable() {
    // The seed is what every fresh cluster saves, so it must pass the check an admin's payload has
    // to pass. If a mapping change makes a shipped highlight field unhighlightable, this fails
    // before the setting reaches a cluster.
    searchSettingsHandler.validateHighlightFields(defaultSearchSettings);
  }

  @Test
  void annotateMarksHighlightabilityFromTheIndexMapping() {
    searchSettingsHandler.annotateHighlightableFields(defaultSearchSettings);

    assertEquals(
        Boolean.TRUE,
        allowedField("table", "description").getHighlight(),
        "An analyzed text field must be offered the highlight toggle");
    assertEquals(
        Boolean.FALSE,
        allowedField("table", "extension.someCustomProperty").getHighlight(),
        "A custom property lives under enabled:false `extension` and can never be highlighted");
  }

  @Test
  void everyConfiguredSearchFieldGetsAHighlightVerdict() {
    // allowedFields is not a complete list of configurable fields — table configures name.keyword,
    // name.compound, displayName.compound and columnNamesFuzzy with no allowedFields entry. The UI
    // renders a row per search field and reads the verdict from allowedFields, so a missing entry
    // silently disabled those toggles.
    searchSettingsHandler.annotateHighlightableFields(defaultSearchSettings);

    List<String> withoutVerdict = new ArrayList<>();
    for (AssetTypeConfiguration assetConfig : defaultSearchSettings.getAssetTypeConfigurations()) {
      Set<String> annotated =
          defaultSearchSettings.getAllowedFields().stream()
              .filter(
                  allowed -> assetConfig.getAssetType().equalsIgnoreCase(allowed.getEntityType()))
              .flatMap(allowed -> allowed.getFields().stream())
              .map(Field::getName)
              .collect(Collectors.toSet());
      CommonUtil.listOrEmpty(assetConfig.getSearchFields()).stream()
          .map(FieldBoost::getField)
          .filter(field -> !annotated.contains(field))
          .forEach(field -> withoutVerdict.add(assetConfig.getAssetType() + ":" + field));
    }

    assertTrue(
        withoutVerdict.isEmpty(),
        "every configured search field must carry a highlight verdict: " + withoutVerdict);
    assertEquals(
        Boolean.TRUE,
        allowedField("table", "name.keyword").getHighlight(),
        "name.keyword is a keyword multi-field and is highlightable");
  }

  @Test
  void annotatedFlagAgreesWithWhatTheSavePathAccepts() {
    // The UI decides what to offer from this flag while the API decides what to accept from the
    // classifier. If they ever disagreed, the UI would offer a toggle whose save 400s.
    searchSettingsHandler.annotateHighlightableFields(defaultSearchSettings);

    List<String> disagreements = new ArrayList<>();
    for (AllowedSearchFields allowed : defaultSearchSettings.getAllowedFields()) {
      for (Field field : allowed.getFields()) {
        boolean saveAccepts = saveAccepts(allowed.getEntityType(), field.getName());
        if (!Boolean.valueOf(saveAccepts).equals(field.getHighlight())) {
          disagreements.add(allowed.getEntityType() + ":" + field.getName());
        }
      }
    }

    assertTrue(
        disagreements.isEmpty(),
        "highlight flag disagrees with what validateHighlightFields accepts: " + disagreements);
  }

  private boolean saveAccepts(String entityType, String fieldName) {
    boolean accepted = true;
    try {
      searchSettingsHandler.validateHighlightFields(highlightSettings(entityType, fieldName));
    } catch (SystemSettingsException e) {
      accepted = false;
    }
    return accepted;
  }

  private Field allowedField(String entityType, String fieldName) {
    return defaultSearchSettings.getAllowedFields().stream()
        .filter(allowed -> entityType.equals(allowed.getEntityType()))
        .flatMap(allowed -> allowed.getFields().stream())
        .filter(field -> fieldName.equals(field.getName()))
        .findFirst()
        .orElseGet(
            () -> {
              // Not every probe field is shipped in allowedFields; annotate one so the assertion
              // still exercises the classifier rather than silently passing on a missing entry.
              Field probe = new Field().withName(fieldName).withDescription("probe");
              AllowedSearchFields allowed =
                  new AllowedSearchFields()
                      .withEntityType(entityType)
                      .withFields(new ArrayList<>(List.of(probe)));
              searchSettingsHandler.annotateHighlightableFields(
                  new SearchSettings().withAllowedFields(new ArrayList<>(List.of(allowed))));
              return probe;
            });
  }

  @Test
  void queryTimeGuardKeepsEveryShippedHighlightField() {
    // The OpenSearch guard classifies without knowing the target index, so it uses the union of
    // unsupported paths across all mappings. That union must never swallow a field the product
    // actually ships — a name that is enabled:false in one index but analyzed in another would be
    // dropped from highlights everywhere.
    List<String> dropped =
        defaultSearchSettings.getAssetTypeConfigurations().stream()
            .flatMap(config -> CommonUtil.listOrEmpty(config.getHighlightFields()).stream())
            .distinct()
            .filter(HighlightFieldClassifier::isHighlightUnsafeField)
            .toList();

    assertTrue(
        dropped.isEmpty(), "Shipped highlight fields dropped by the query-time guard: " + dropped);
  }

  @Test
  void saveIsRejectedForNonIndexedHighlightField() {
    SearchSettings settings = highlightSettings("table", "extension.someCustomProperty");

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> searchSettingsHandler.validateHighlightFields(settings));

    assertTrue(
        exception.getMessage().contains("extension.someCustomProperty"),
        "Message must name the offending field: " + exception.getMessage());
    assertTrue(
        exception.getMessage().contains("not indexed"),
        "Message must explain why: " + exception.getMessage());
  }

  @Test
  void saveIsRejectedForFlattenedHighlightField() {
    SearchSettings settings = highlightSettings("aiApplication", "aiGovernance.complianceStatus");

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> searchSettingsHandler.validateHighlightFields(settings));

    assertTrue(
        exception.getMessage().contains("flattened"),
        "Message must explain why: " + exception.getMessage());
  }

  @Test
  void aHighlightFieldThisClusterAlreadyStoredIsDroppedRatherThanRejected() {
    // A cluster upgraded from before this check carries the bad value, and the UI round-trips the
    // whole highlightFields array on every save (a disabled toggle does not remove the entry).
    // Rejecting would 400 every future save — including unrelated edits — with an error the admin
    // cannot clear from the UI. Dropping it self-heals on the next save.
    SearchSettings stored = highlightSettings("table", "extension.someCustomProperty");
    SearchSettings incoming = highlightSettings("table", "extension.someCustomProperty");
    incoming.getAssetTypeConfigurations().get(0).getHighlightFields().add("description");

    searchSettingsHandler.validateHighlightFields(incoming, stored);

    assertEquals(
        List.of("description"),
        incoming.getAssetTypeConfigurations().get(0).getHighlightFields(),
        "the legacy value must be dropped and the good one kept");
  }

  @Test
  void aNewlyAddedUnsupportedHighlightFieldIsStillRejectedWhenOthersWereStored() {
    // Dropping legacy values must not become a blanket amnesty — a value this payload introduces is
    // still refused even when the same asset type already carries a different bad one.
    SearchSettings stored = highlightSettings("table", "extension.alreadyThere");
    SearchSettings incoming = highlightSettings("table", "extension.alreadyThere");
    incoming.getAssetTypeConfigurations().get(0).getHighlightFields().add("extension.brandNew");

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> searchSettingsHandler.validateHighlightFields(incoming, stored));

    assertTrue(
        exception.getMessage().contains("extension.brandNew"),
        "the newly added field must be the one rejected: " + exception.getMessage());
  }

  @Test
  void saveIsAcceptedForAnalyzedHighlightField() {
    searchSettingsHandler.validateHighlightFields(highlightSettings("table", "description"));
  }

  private SearchSettings highlightSettings(String assetType, String highlightField) {
    AssetTypeConfiguration assetConfig =
        new AssetTypeConfiguration()
            .withAssetType(assetType)
            .withHighlightFields(new ArrayList<>(List.of(highlightField)));
    return new SearchSettings().withAssetTypeConfigurations(new ArrayList<>(List.of(assetConfig)));
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
  void testRankingSignalsMaxBoostMustBePositive() {
    AssetTypeConfiguration config = createAssetConfig("table", "name", 10.0);
    config.setRanking(
        new RankingConfiguration()
            .withEnabled(true)
            .withStages(
                List.of(
                    new RankingStage()
                        .withName("exactName")
                        .withFields(List.of("name"))
                        .withWeight(1.0)))
            .withSignals(new RankingSignals().withMaxBoost(0.0)));

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> searchSettingsHandler.validateAssetTypeConfiguration(config));

    assertTrue(exception.getMessage().contains("maxBoost must be positive"));
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
