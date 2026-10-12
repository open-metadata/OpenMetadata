package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;

class SearchIndexSettingsRepairTest {

  private static final String STORED_SETTINGS =
      """
      {
        "assetTypeConfigurations": [
          {
            "assetType": "mlmodel",
            "searchFields": [
              {"field": "mlFeatures.name", "boost": 8.0, "matchType": "standard"}
            ],
            "aggregations": [
              {"name": "mlFeatures.name.keyword", "type": "terms", "field": "mlFeatures.name.keyword"}
            ],
            "highlightFields": ["name", "mlFeatures.name"]
          },
          {
            "assetType": "searchIndex",
            "searchFields": [
              {"field": "name", "boost": 10.0, "matchType": "phrase"},
              {"field": "mlFeatures.name", "boost": 8.0, "matchType": "standard"},
              {"field": "mlFeatures.description", "boost": 1.0, "matchType": "standard"}
            ],
            "aggregations": [
              {"name": "mlFeatures.name.keyword", "type": "terms", "field": "mlFeatures.name.keyword"}
            ],
            "highlightFields": ["name", "description", "mlFeatures.name", "mlFeatures.description"]
          }
        ],
        "allowedFields": [
          {
            "entityType": "searchIndex",
            "fields": [
              {"name": "name"},
              {"name": "searchIndex.responseSchema.name"},
              {"name": "searchIndex.responseSchema.description"}
            ]
          }
        ]
      }
      """;

  private static final String SEED_SETTINGS =
      """
      {
        "assetTypeConfigurations": [
          {
            "assetType": "searchIndex",
            "searchFields": [
              {"field": "name", "boost": 10.0, "matchType": "phrase"},
              {"field": "fields.name", "boost": 8.0, "matchType": "standard"},
              {"field": "fields.name.keyword", "boost": 2.0, "matchType": "exact"},
              {"field": "fields.description", "boost": 1.0, "matchType": "standard"}
            ],
            "aggregations": [
              {"name": "fields.name.keyword", "type": "terms", "field": "fields.name.keyword"}
            ],
            "highlightFields": ["name", "description", "fields.name", "fields.description"]
          }
        ],
        "allowedFields": [
          {
            "entityType": "searchIndex",
            "fields": [
              {"name": "name"},
              {"name": "fields.name"},
              {"name": "fields.name.keyword"},
              {"name": "fields.description"}
            ]
          }
        ]
      }
      """;

  private SearchSettings stored() {
    return JsonUtils.readValue(STORED_SETTINGS, SearchSettings.class);
  }

  private SearchSettings seed() {
    return JsonUtils.readValue(SEED_SETTINGS, SearchSettings.class);
  }

  private AssetTypeConfiguration asset(SearchSettings settings, String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(config -> assetType.equals(config.getAssetType()))
        .findFirst()
        .orElseThrow();
  }

  private List<String> searchFieldNames(AssetTypeConfiguration asset) {
    return asset.getSearchFields().stream().map(field -> field.getField()).toList();
  }

  @Test
  void repairReplacesMlFeatureSearchFieldsWithIndexedFields() {
    SearchSettings settings = stored();

    assertTrue(SearchIndexSettingsRepair.repairSearchIndexSettings(settings, seed()));

    AssetTypeConfiguration searchIndex = asset(settings, "searchIndex");
    assertEquals(
        List.of("name", "fields.name", "fields.name.keyword", "fields.description"),
        searchFieldNames(searchIndex));
    assertEquals(
        List.of("fields.name.keyword"),
        searchIndex.getAggregations().stream().map(agg -> agg.getField()).toList());
    assertEquals(
        List.of("name", "description", "fields.name", "fields.description"),
        searchIndex.getHighlightFields());
  }

  @Test
  void repairReplacesResponseSchemaAllowedFieldsWithIndexedFields() {
    SearchSettings settings = stored();

    assertTrue(SearchIndexSettingsRepair.repairSearchIndexSettings(settings, seed()));

    AllowedSearchFields allowed =
        settings.getAllowedFields().stream()
            .filter(entry -> "searchIndex".equals(entry.getEntityType()))
            .findFirst()
            .orElseThrow();
    assertEquals(
        List.of("name", "fields.name", "fields.name.keyword", "fields.description"),
        allowed.getFields().stream().map(field -> field.getName()).toList());
  }

  @Test
  void repairLeavesMlModelConfigurationUntouched() {
    SearchSettings settings = stored();

    SearchIndexSettingsRepair.repairSearchIndexSettings(settings, seed());

    AssetTypeConfiguration mlmodel = asset(settings, "mlmodel");
    assertEquals(List.of("mlFeatures.name"), searchFieldNames(mlmodel));
    assertEquals(List.of("name", "mlFeatures.name"), mlmodel.getHighlightFields());
  }

  @Test
  void repairIsIdempotent() {
    SearchSettings settings = stored();
    SearchIndexSettingsRepair.repairSearchIndexSettings(settings, seed());

    assertFalse(SearchIndexSettingsRepair.repairSearchIndexSettings(settings, seed()));
  }

  @Test
  void repairSkipsSettingsWithoutSearchIndexConfiguration() {
    assertFalse(SearchIndexSettingsRepair.repairSearchIndexSettings(new SearchSettings(), seed()));
  }
}
