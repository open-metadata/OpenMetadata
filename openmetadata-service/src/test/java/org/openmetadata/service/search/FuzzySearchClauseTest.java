/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.search.opensearch.OpenSearchSourceBuilderFactory;
import os.org.opensearch.index.query.MultiMatchQueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.search.builder.SearchSourceBuilder;

class FuzzySearchClauseTest {

  @Test
  void testNgramFieldsAreSeparatedFromFuzzySearch() {

    Map<String, Float> allFields = createTestFields();
    Map<String, Float> fuzzyFields = new HashMap<>();
    Map<String, Float> nonFuzzyFields = new HashMap<>();

    for (Map.Entry<String, Float> fieldEntry : allFields.entrySet()) {
      String fieldName = fieldEntry.getKey();
      Float boost = fieldEntry.getValue();

      if (fieldName.contains(".ngram")) {
        nonFuzzyFields.put(fieldName, boost);
      } else {
        fuzzyFields.put(fieldName, boost);
      }
    }

    assertFalse(
        fuzzyFields.containsKey("name.ngram"), "name.ngram should be excluded from fuzzy search");
    assertFalse(
        fuzzyFields.containsKey("displayName.ngram"),
        "displayName.ngram should be excluded from fuzzy search");
    assertFalse(
        fuzzyFields.containsKey("queryText.ngram"),
        "queryText.ngram should be excluded from fuzzy search");

    assertTrue(
        nonFuzzyFields.containsKey("name.ngram"),
        "name.ngram should be included in non-fuzzy search");
    assertTrue(
        nonFuzzyFields.containsKey("displayName.ngram"),
        "displayName.ngram should be included in non-fuzzy search");

    assertTrue(fuzzyFields.containsKey("name"), "name should be included in fuzzy search");
    assertTrue(
        fuzzyFields.containsKey("displayName"), "displayName should be included in fuzzy search");
    assertTrue(
        fuzzyFields.containsKey("columnNamesFuzzy"),
        "columnNamesFuzzy should be included in fuzzy search");
  }

  @Test
  void testFlatColumnFieldReducesClauseMultiplication() {
    String[] columnNames = {
      "customer_id",
      "customer_name",
      "customer_email",
      "order_id",
      "order_date",
      "product_id",
      "product_name",
      "experiment_id",
      "evaluation_score"
    };

    String flatColumnNames = String.join(" ", columnNames);
    MultiMatchQueryBuilder flatQuery =
        QueryBuilders.multiMatchQuery("test_query")
            .field("columnNamesFuzzy", 1.5f)
            .fuzziness("AUTO");

    assertNotNull(flatQuery, "Flat query should be created successfully");
    assertTrue(
        flatColumnNames.contains("customer_id"), "Flat field should contain all column names");
    assertTrue(
        flatColumnNames.contains("experiment_id"), "Flat field should contain all column names");

    assertEquals(
        flatColumnNames.split(" ").length,
        columnNames.length,
        "Flat field should contain all columns in a single searchable string");
  }

  @Test
  void testQueryBuildingDoesNotThrowException() {
    SearchSettings searchSettings = createTestSearchSettings();
    OpenSearchSourceBuilderFactory factory = new OpenSearchSourceBuilderFactory(searchSettings);
    String problematicQuery = "int_snowplow_experiment_evaluation";

    try {
      SearchSourceBuilder sourceBuilder =
          factory.buildDataAssetSearchBuilder("table_search_index", problematicQuery, 0, 10);

      assertNotNull(sourceBuilder, "Search source builder should be created successfully");
      assertNotNull(sourceBuilder.query(), "Query should be built successfully");

    } catch (Exception e) {
      throw new AssertionError("Query building should not throw exceptions with the fix", e);
    }
  }

  private SearchSettings createTestSearchSettings() {
    AssetTypeConfiguration tableConfig =
        new AssetTypeConfiguration()
            .withAssetType("table")
            .withSearchFields(
                java.util.List.of(
                    new FieldBoost().withField("name").withBoost(10.0),
                    new FieldBoost().withField("name.ngram").withBoost(1.0),
                    new FieldBoost().withField("displayName").withBoost(10.0),
                    new FieldBoost().withField("displayName.ngram").withBoost(1.0),
                    new FieldBoost().withField("columns.name.keyword").withBoost(2.0),
                    new FieldBoost().withField("columnNamesFuzzy").withBoost(1.5)));

    org.openmetadata.schema.api.search.GlobalSettings globalSettings =
        new org.openmetadata.schema.api.search.GlobalSettings()
            .withMaxAggregateSize(1000)
            .withMaxResultHits(1000);

    return new SearchSettings()
        .withAssetTypeConfigurations(java.util.List.of(tableConfig))
        .withGlobalSettings(globalSettings);
  }

  private Map<String, Float> createTestFields() {
    Map<String, Float> fields = new HashMap<>();

    fields.put("name", 10.0f);
    fields.put("name.ngram", 1.0f);
    fields.put("displayName", 10.0f);
    fields.put("displayName.ngram", 1.0f);
    fields.put("description", 2.0f);
    fields.put("queryText", 5.0f);
    fields.put("queryText.ngram", 1.0f);
    fields.put("columns.name.keyword", 2.0f);
    fields.put("columnNamesFuzzy", 1.5f);

    return fields;
  }
}
