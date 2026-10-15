package org.openmetadata.service.migration.utils.v202;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;

class SearchNameKeywordRepairTest {

  private static final String SEED_SETTINGS =
      """
      {
        "assetTypeConfigurations": [
          {
            "assetType": "database",
            "searchFields": [
              {"field": "displayName.keyword", "boost": 20.0, "matchType": "exact"},
              {"field": "name.keyword", "boost": 20.0, "matchType": "exact"},
              {"field": "name", "boost": 10.0, "matchType": "phrase"}
            ]
          },
          {
            "assetType": "query",
            "searchFields": [
              {"field": "name.keyword", "boost": 20.0, "matchType": "exact"},
              {"field": "name", "boost": 10.0, "matchType": "phrase"}
            ]
          },
          {
            "assetType": "tableColumn",
            "searchFields": [
              {"field": "name.keyword", "boost": 20.0, "matchType": "exact"},
              {"field": "name", "boost": 10.0, "matchType": "phrase"}
            ]
          }
        ]
      }
      """;

  private SearchSettings seed() {
    return JsonUtils.readValue(SEED_SETTINGS, SearchSettings.class);
  }

  private SearchSettings storedWith(String assetType, List<String> fields) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType(assetType);
    config.setSearchFields(
        new java.util.ArrayList<>(
            fields.stream()
                .map(
                    f ->
                        new FieldBoost()
                            .withField(f)
                            .withBoost(10.0)
                            .withMatchType(FieldBoost.MatchType.PHRASE))
                .toList()));
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(new java.util.ArrayList<>(List.of(config)));
    return settings;
  }

  private List<String> searchFieldNames(SearchSettings settings, String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(config -> assetType.equals(config.getAssetType()))
        .findFirst()
        .orElseThrow()
        .getSearchFields()
        .stream()
        .map(FieldBoost::getField)
        .toList();
  }

  @Test
  void repairAddsNameKeywordToTargetAssetMissingIt() {
    SearchSettings stored = storedWith("database", List.of("displayName.keyword", "name"));

    assertTrue(SearchNameKeywordRepair.repairNameKeywordSearchFields(stored, seed()));

    List<String> fields = searchFieldNames(stored, "database");
    assertTrue(fields.contains("name.keyword"), "name.keyword should be added to database");
    // Inserted right after displayName.keyword, matching the seed ordering.
    assertEquals(List.of("displayName.keyword", "name.keyword", "name"), fields);
  }

  @Test
  void repairDoesNotDuplicateExistingNameKeyword() {
    SearchSettings stored = storedWith("query", List.of("name.keyword", "name"));

    assertFalse(SearchNameKeywordRepair.repairNameKeywordSearchFields(stored, seed()));

    assertEquals(
        1, searchFieldNames(stored, "query").stream().filter("name.keyword"::equals).count());
  }

  @Test
  void repairIgnoresAssetTypesOutsideTargetSet() {
    // tableColumn is intentionally excluded from the repair even though the seed has name.keyword.
    SearchSettings stored = storedWith("tableColumn", List.of("name"));

    assertFalse(SearchNameKeywordRepair.repairNameKeywordSearchFields(stored, seed()));

    assertFalse(searchFieldNames(stored, "tableColumn").contains("name.keyword"));
  }

  @Test
  void repairIsIdempotent() {
    SearchSettings stored = storedWith("database", List.of("displayName.keyword", "name"));
    SearchNameKeywordRepair.repairNameKeywordSearchFields(stored, seed());

    assertFalse(SearchNameKeywordRepair.repairNameKeywordSearchFields(stored, seed()));
  }

  @Test
  void repairSkipsSettingsWithoutAssetConfigurations() {
    assertFalse(
        SearchNameKeywordRepair.repairNameKeywordSearchFields(new SearchSettings(), seed()));
  }

  @Test
  void repairHandlesTargetAssetWithNullSearchFields() {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType("database");
    config.setSearchFields(null);
    SearchSettings stored = new SearchSettings();
    stored.setAssetTypeConfigurations(new java.util.ArrayList<>(List.of(config)));

    assertTrue(SearchNameKeywordRepair.repairNameKeywordSearchFields(stored, seed()));
    assertTrue(searchFieldNames(stored, "database").contains("name.keyword"));
  }
}
