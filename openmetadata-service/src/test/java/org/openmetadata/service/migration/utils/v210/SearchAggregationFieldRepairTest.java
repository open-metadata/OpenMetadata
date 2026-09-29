package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;

class SearchAggregationFieldRepairTest {

  private static final String SEED_SETTINGS =
      """
      {
        "assetTypeConfigurations": [
          {
            "assetType": "topic",
            "aggregations": [
              {"name": "messageSchema.schemaFields.name.keyword", "type": "terms", "field": "messageSchema.schemaFields.name.keyword"},
              {"name": "fieldNames", "type": "terms", "field": "fieldNames"}
            ]
          },
          {
            "assetType": "apiEndpoint",
            "aggregations": [
              {"name": "responseSchema.schemaFields.name", "type": "terms", "field": "responseSchema.schemaFields.name.keyword"},
              {"name": "requestSchema.schemaFields.name", "type": "terms", "field": "requestSchema.schemaFields.name.keyword"},
              {"name": "requestFieldNames", "type": "terms", "field": "requestFieldNames"},
              {"name": "responseFieldNames", "type": "terms", "field": "responseFieldNames"}
            ]
          }
        ]
      }
      """;

  private SearchSettings seed() {
    return JsonUtils.readValue(SEED_SETTINGS, SearchSettings.class);
  }

  private SearchSettings stored(String json) {
    return JsonUtils.readValue(json, SearchSettings.class);
  }

  private List<Aggregation> aggregations(SearchSettings settings, String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(config -> assetType.equals(config.getAssetType()))
        .findFirst()
        .orElseThrow()
        .getAggregations();
  }

  private String fieldNames(SearchSettings settings, String assetType, String aggregationName) {
    return aggregations(settings, assetType).stream()
        .filter(agg -> aggregationName.equals(agg.getName()))
        .map(Aggregation::getField)
        .findFirst()
        .orElse(null);
  }

  @Test
  void repairRetargetsTopicFieldNamesAggregationFromTheMisspelledField() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "topic",
                  "aggregations": [
                    {"name": "messageSchema.schemaFields.name.keyword", "type": "terms", "field": "messageSchema.schemaFields.name.keyword"},
                    {"name": "fieldNames", "type": "terms", "field": "fieldsNames"}
                  ]
                }
              ]
            }
            """);

    assertTrue(SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()));

    assertEquals("fieldNames", fieldNames(stored, "topic", "fieldNames"));
  }

  @Test
  void repairSplitsApiEndpointFieldNamesAggregationIntoRequestAndResponse() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "apiEndpoint",
                  "aggregations": [
                    {"name": "responseSchema.schemaFields.name", "type": "terms", "field": "responseSchema.schemaFields.name.keyword"},
                    {"name": "requestSchema.schemaFields.name", "type": "terms", "field": "requestSchema.schemaFields.name.keyword"},
                    {"name": "fieldNames", "type": "terms", "field": "fieldsNames"}
                  ]
                }
              ]
            }
            """);

    assertTrue(SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()));

    List<Aggregation> aggregations = aggregations(stored, "apiEndpoint");
    assertEquals(
        List.of(
            "responseSchema.schemaFields.name",
            "requestSchema.schemaFields.name",
            "requestFieldNames",
            "responseFieldNames"),
        aggregations.stream().map(Aggregation::getName).toList(),
        "the stale fieldNames aggregation must be replaced by requestFieldNames and responseFieldNames");
    assertEquals("requestFieldNames", fieldNames(stored, "apiEndpoint", "requestFieldNames"));
    assertEquals("responseFieldNames", fieldNames(stored, "apiEndpoint", "responseFieldNames"));
  }

  @Test
  void repairIsIdempotent() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "topic",
                  "aggregations": [
                    {"name": "fieldNames", "type": "terms", "field": "fieldsNames"}
                  ]
                },
                {
                  "assetType": "apiEndpoint",
                  "aggregations": [
                    {"name": "fieldNames", "type": "terms", "field": "fieldsNames"}
                  ]
                }
              ]
            }
            """);
    SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed());

    assertFalse(
        SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()),
        "a second repair pass must not report any change");

    assertEquals("fieldNames", fieldNames(stored, "topic", "fieldNames"));
    assertEquals(
        List.of("requestFieldNames", "responseFieldNames"),
        aggregations(stored, "apiEndpoint").stream().map(Aggregation::getName).toList());
  }

  @Test
  void repairLeavesTopicAloneWhenFieldIsAlreadyCorrect() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "topic",
                  "aggregations": [
                    {"name": "fieldNames", "type": "terms", "field": "fieldNames"}
                  ]
                }
              ]
            }
            """);

    assertFalse(SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()));

    assertEquals("fieldNames", fieldNames(stored, "topic", "fieldNames"));
  }

  @Test
  void repairDoesNotDuplicateRequestResponseAggregationsAlreadyPresent() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "apiEndpoint",
                  "aggregations": [
                    {"name": "requestFieldNames", "type": "terms", "field": "requestFieldNames"},
                    {"name": "responseFieldNames", "type": "terms", "field": "responseFieldNames"},
                    {"name": "fieldNames", "type": "terms", "field": "fieldsNames"}
                  ]
                }
              ]
            }
            """);

    assertTrue(SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()));

    List<Aggregation> aggregations = aggregations(stored, "apiEndpoint");
    assertEquals(
        1, aggregations.stream().filter(agg -> "requestFieldNames".equals(agg.getName())).count());
    assertEquals(
        1, aggregations.stream().filter(agg -> "responseFieldNames".equals(agg.getName())).count());
    assertEquals(
        0, aggregations.stream().filter(agg -> "fieldNames".equals(agg.getName())).count());
  }

  @Test
  void repairAddsRequestResponseAggregationsWhenStaleOneWasAlreadyRemoved() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "apiEndpoint",
                  "aggregations": [
                    {"name": "responseSchema.schemaFields.name", "type": "terms", "field": "responseSchema.schemaFields.name.keyword"}
                  ]
                }
              ]
            }
            """);

    assertTrue(SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()));

    assertEquals("requestFieldNames", fieldNames(stored, "apiEndpoint", "requestFieldNames"));
    assertEquals("responseFieldNames", fieldNames(stored, "apiEndpoint", "responseFieldNames"));
  }

  @Test
  void repairSkipsSettingsWithoutAssetConfigurations() {
    assertFalse(
        SearchAggregationFieldRepair.repairFieldNamesAggregations(new SearchSettings(), seed()));
  }

  @Test
  void repairSkipsSettingsWithoutTopicOrApiEndpoint() {
    SearchSettings stored =
        stored(
            """
            {
              "assetTypeConfigurations": [
                {
                  "assetType": "table",
                  "aggregations": [
                    {"name": "database.displayName.keyword", "type": "terms", "field": "database.displayName.keyword"}
                  ]
                }
              ]
            }
            """);

    assertFalse(SearchAggregationFieldRepair.repairFieldNamesAggregations(stored, seed()));
  }
}
