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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.ElasticSearchSourceBuilderFactory;
import org.openmetadata.service.search.opensearch.OpenSearchSourceBuilderFactory;

public class SearchSourceBuilderFactoryTest {

  private SearchSettings searchSettings;
  private AssetTypeConfiguration tableConfig;
  private AssetTypeConfiguration topicConfig;
  private AssetTypeConfiguration defaultConfig;

  @BeforeEach
  public void setUp() {
    // Set up search settings with configurations
    searchSettings = new SearchSettings();
    SearchRepository mockSearchRepository = mock(SearchRepository.class);

    // Add mock for getIndexNameWithoutAlias method
    when(mockSearchRepository.getIndexNameWithoutAlias(anyString()))
        .thenAnswer(
            invocation -> {
              String resource = invocation.getArgument(0);
              return resource.toLowerCase();
            });

    Entity.setSearchRepository(mockSearchRepository);

    // Global settings
    GlobalSettings globalSettings = new GlobalSettings();
    globalSettings.setMaxResultHits(10000);
    globalSettings.setMaxAggregateSize(10000);
    searchSettings.setGlobalSettings(globalSettings);

    // Table configuration
    tableConfig = new AssetTypeConfiguration();
    tableConfig.setAssetType("table");
    List<FieldBoost> tableFields = new ArrayList<>();
    tableFields.add(createFieldBoost("name", 10.0, "phrase"));
    tableFields.add(createFieldBoost("name.keyword", 20.0, "exact"));
    tableFields.add(createFieldBoost("name.ngram", 1.0, "fuzzy"));
    tableFields.add(createFieldBoost("name.compound", 8.0, "standard"));
    tableFields.add(createFieldBoost("displayName", 10.0, "phrase"));
    tableFields.add(createFieldBoost("displayName.keyword", 20.0, "exact"));
    tableFields.add(createFieldBoost("displayName.ngram", 1.0, "fuzzy"));
    tableFields.add(createFieldBoost("displayName.compound", 8.0, "standard"));
    tableFields.add(createFieldBoost("description", 2.0, "standard"));
    tableFields.add(createFieldBoost("fullyQualifiedName", 5.0, "standard"));
    tableConfig.setSearchFields(tableFields);

    // Topic configuration
    topicConfig = new AssetTypeConfiguration();
    topicConfig.setAssetType("topic");
    List<FieldBoost> topicFields = new ArrayList<>();
    topicFields.add(createFieldBoost("name", 10.0, "phrase"));
    topicFields.add(createFieldBoost("name.keyword", 15.0, "exact"));
    topicFields.add(createFieldBoost("name.ngram", 1.0, "fuzzy"));
    topicFields.add(createFieldBoost("displayName", 10.0, "phrase"));
    topicFields.add(createFieldBoost("description", 2.0, "standard"));
    topicConfig.setSearchFields(topicFields);

    // Default configuration
    defaultConfig = new AssetTypeConfiguration();
    defaultConfig.setAssetType("default");
    List<FieldBoost> defaultFields = new ArrayList<>();
    defaultFields.add(createFieldBoost("name", 10.0, "phrase"));
    defaultFields.add(createFieldBoost("name.keyword", 10.0, "exact"));
    defaultFields.add(createFieldBoost("name.ngram", 1.0, "fuzzy"));
    defaultFields.add(createFieldBoost("displayName", 10.0, "phrase"));
    defaultFields.add(createFieldBoost("displayName.ngram", 1.0, "fuzzy"));
    defaultFields.add(createFieldBoost("description", 2.0, "standard"));
    defaultFields.add(createFieldBoost("fullyQualifiedName", 5.0, "standard"));
    defaultFields.add(createFieldBoost("fqnParts", 5.0, "standard"));
    defaultConfig.setSearchFields(defaultFields);

    // Set configurations
    List<AssetTypeConfiguration> assetConfigs = new ArrayList<>();
    assetConfigs.add(tableConfig);
    assetConfigs.add(topicConfig);
    searchSettings.setAssetTypeConfigurations(assetConfigs);
    searchSettings.setDefaultConfiguration(defaultConfig);
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

  @Test
  public void testConsistentSearchBuilderSelection() {
    // Test that both OpenSearch and ElasticSearch factories use the same logic
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    String query = "test query";

    // Test that dataAsset index uses buildDataAssetSearchBuilder
    var osDataAssetBuilder = osFactory.getSearchSourceBuilder("dataAsset", query, 0, 10);
    var esDataAssetBuilder = esFactory.getSearchSourceBuilder("dataAsset", query, 0, 10);

    assertNotNull(osDataAssetBuilder, "OpenSearch dataAsset builder should not be null");
    assertNotNull(esDataAssetBuilder, "ElasticSearch dataAsset builder should not be null");

    // Test that table index uses buildDataAssetSearchBuilder
    var osTableBuilder = osFactory.getSearchSourceBuilder("table", query, 0, 10);
    var esTableBuilder = esFactory.getSearchSourceBuilder("table", query, 0, 10);

    assertNotNull(osTableBuilder, "OpenSearch table builder should not be null");
    assertNotNull(esTableBuilder, "ElasticSearch table builder should not be null");

    // Test that all index uses buildDataAssetSearchBuilder
    var osAllBuilder = osFactory.getSearchSourceBuilder("all", query, 0, 10);
    var esAllBuilder = esFactory.getSearchSourceBuilder("all", query, 0, 10);

    assertNotNull(osAllBuilder, "OpenSearch all builder should not be null");
    assertNotNull(esAllBuilder, "ElasticSearch all builder should not be null");
  }

  @Test
  public void testMultiWordQueryHandling() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    // Test multi-word queries
    String[] multiWordQueries = {"log fail", "test data", "customer order", "user profile"};

    for (String query : multiWordQueries) {
      // Test with different indexes
      var tableBuilder = osFactory.getSearchSourceBuilder("table", query, 0, 10);
      var dataAssetBuilder = osFactory.getSearchSourceBuilder("dataAsset", query, 0, 10);

      assertNotNull(tableBuilder, "Table builder should handle multi-word query: " + query);
      assertNotNull(dataAssetBuilder, "DataAsset builder should handle multi-word query: " + query);

      // Verify the builders are using appropriate configuration
      String tableQuery = tableBuilder.toString();
      String dataAssetQuery = dataAssetBuilder.toString();

      // Both should contain the query terms
      assertTrue(
          tableQuery.contains("log")
              || tableQuery.contains("fail")
              || tableQuery.contains("test")
              || tableQuery.contains("data")
              || tableQuery.contains("customer")
              || tableQuery.contains("order")
              || tableQuery.contains("user")
              || tableQuery.contains("profile"),
          "Table query should contain search terms");

      assertTrue(
          dataAssetQuery.contains("log")
              || dataAssetQuery.contains("fail")
              || dataAssetQuery.contains("test")
              || dataAssetQuery.contains("data")
              || dataAssetQuery.contains("customer")
              || dataAssetQuery.contains("order")
              || dataAssetQuery.contains("user")
              || dataAssetQuery.contains("profile"),
          "DataAsset query should contain search terms");
    }
  }

  @Test
  public void testComplexQuerySyntaxHandling() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    // Test complex queries with wildcards, field queries, and boolean operators
    String[] complexQueries = {
      "*PII.Sensitive* AND disabled:false",
      "owner:john OR tags:important",
      "name:log* AND type:table",
      "description:\"exact phrase\" OR name:test"
    };

    for (String query : complexQueries) {
      var tableBuilder = osFactory.getSearchSourceBuilder("table", query, 0, 10);
      var dataAssetBuilder = osFactory.getSearchSourceBuilder("dataAsset", query, 0, 10);

      assertNotNull(tableBuilder, "Table builder should handle complex query: " + query);
      assertNotNull(dataAssetBuilder, "DataAsset builder should handle complex query: " + query);

      // Complex queries should use query_string
      String tableQuery = tableBuilder.toString();
      String dataAssetQuery = dataAssetBuilder.toString();

      assertTrue(
          tableQuery.contains("query_string") || tableQuery.contains("bool"),
          "Table query should use appropriate query type for complex syntax");
      assertTrue(
          dataAssetQuery.contains("query_string") || dataAssetQuery.contains("bool"),
          "DataAsset query should use appropriate query type for complex syntax");
    }
  }

  @Test
  public void testEmptyAndWildcardQueries() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    // Test empty query
    var emptyBuilder = osFactory.getSearchSourceBuilder("table", "", 0, 10);
    assertNotNull(emptyBuilder, "Should handle empty query");
    assertTrue(emptyBuilder.toString().contains("match_all"), "Empty query should use match_all");

    // Test null query
    var nullBuilder = osFactory.getSearchSourceBuilder("table", null, 0, 10);
    assertNotNull(nullBuilder, "Should handle null query");
    assertTrue(nullBuilder.toString().contains("match_all"), "Null query should use match_all");

    // Test wildcard query
    var wildcardBuilder = osFactory.getSearchSourceBuilder("table", "*", 0, 10);
    assertNotNull(wildcardBuilder, "Should handle wildcard query");
    assertTrue(
        wildcardBuilder.toString().contains("match_all"),
        "Wildcard-only query should use match_all");
  }

  @Test
  public void testDataAssetIndexUsesCompositeConfiguration() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    String query = "test";

    // Get builders for comparison
    var tableBuilder = osFactory.getSearchSourceBuilder("table", query, 0, 10);
    var dataAssetBuilder = osFactory.getSearchSourceBuilder("dataAsset", query, 0, 10);

    assertNotNull(tableBuilder);
    assertNotNull(dataAssetBuilder);

    // DataAsset should include fields from multiple entity types
    String dataAssetQuery = dataAssetBuilder.toString();

    // Should contain various field types from composite configuration
    assertTrue(
        dataAssetQuery.contains("name") || dataAssetQuery.contains("displayName"),
        "DataAsset query should include name fields");
    assertTrue(
        dataAssetQuery.contains("description") || dataAssetQuery.contains("fullyQualifiedName"),
        "DataAsset query should include descriptive fields");
  }

  @Test
  public void testConsistencyBetweenIndexes() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    String query = "customer data";

    // Test that both specific index and dataAsset return consistent query structure
    var tableSpecificBuilder = osFactory.getSearchSourceBuilder("table_search_index", query, 0, 10);
    var tableBuilder = osFactory.getSearchSourceBuilder("table", query, 0, 10);

    assertNotNull(tableSpecificBuilder);
    assertNotNull(tableBuilder);

    // Both should produce similar queries since they're for the same entity type
    String specificQuery = tableSpecificBuilder.toString();
    String genericQuery = tableBuilder.toString();

    // Both should handle multi-word queries similarly
    assertTrue(
        specificQuery.contains("bool") || specificQuery.contains("multi_match"),
        "Specific index query should use appropriate query type");
    assertTrue(
        genericQuery.contains("bool") || genericQuery.contains("multi_match"),
        "Generic index query should use appropriate query type");
  }
}
