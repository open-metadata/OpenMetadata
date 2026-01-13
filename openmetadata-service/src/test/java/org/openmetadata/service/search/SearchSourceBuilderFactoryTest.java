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

    // Test that dataAsset index uses buildDataAssetSearchBuilderV2
    var osDataAssetBuilder = osFactory.getSearchSourceBuilderV2("dataAsset", query, 0, 10);
    var esDataAssetBuilder = esFactory.getSearchSourceBuilderV2("dataAsset", query, 0, 10);

    assertNotNull(osDataAssetBuilder, "OpenSearch dataAsset builder should not be null");
    assertNotNull(esDataAssetBuilder, "ElasticSearch dataAsset builder should not be null");

    // Test that table index uses buildDataAssetSearchBuilderV2
    var osTableBuilder = osFactory.getSearchSourceBuilderV2("table", query, 0, 10);
    var esTableBuilder = esFactory.getSearchSourceBuilderV2("table", query, 0, 10);

    assertNotNull(osTableBuilder, "OpenSearch table builder should not be null");
    assertNotNull(esTableBuilder, "ElasticSearch table builder should not be null");

    // Test that all index uses buildDataAssetSearchBuilderV2
    var osAllBuilder = osFactory.getSearchSourceBuilderV2("all", query, 0, 10);
    var esAllBuilder = esFactory.getSearchSourceBuilderV2("all", query, 0, 10);

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
      var tableBuilder = osFactory.getSearchSourceBuilderV2("table", query, 0, 10);
      var dataAssetBuilder = osFactory.getSearchSourceBuilderV2("dataAsset", query, 0, 10);

      // Verify builders are created with valid queries
      assertNotNull(tableBuilder, "Table builder should handle multi-word query: " + query);
      assertNotNull(dataAssetBuilder, "DataAsset builder should handle multi-word query: " + query);
      assertNotNull(tableBuilder.query(), "Table query should not be null");
      assertNotNull(dataAssetBuilder.query(), "DataAsset query should not be null");

      // Verify pagination parameters are set correctly
      assertEquals(0, tableBuilder.from(), "Table builder should have correct 'from' value");
      assertEquals(10, tableBuilder.size(), "Table builder should have correct 'size' value");
      assertEquals(
          0, dataAssetBuilder.from(), "DataAsset builder should have correct 'from' value");
      assertEquals(
          10, dataAssetBuilder.size(), "DataAsset builder should have correct 'size' value");
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
      var tableBuilder = osFactory.getSearchSourceBuilderV2("table", query, 0, 10);
      var dataAssetBuilder = osFactory.getSearchSourceBuilderV2("dataAsset", query, 0, 10);

      // Verify builders are created successfully for complex queries
      assertNotNull(tableBuilder, "Table builder should handle complex query: " + query);
      assertNotNull(dataAssetBuilder, "DataAsset builder should handle complex query: " + query);
      assertNotNull(tableBuilder.query(), "Table query should not be null for complex syntax");
      assertNotNull(
          dataAssetBuilder.query(), "DataAsset query should not be null for complex syntax");

      // Verify pagination is set correctly
      assertEquals(0, tableBuilder.from());
      assertEquals(10, tableBuilder.size());
    }
  }

  @Test
  public void testEmptyAndWildcardQueries() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    // Test empty query - should return a valid builder with a query
    var emptyBuilder = osFactory.getSearchSourceBuilderV2("table", "", 0, 10);
    assertNotNull(emptyBuilder, "Should handle empty query");
    assertNotNull(
        emptyBuilder.query(), "Empty query should have a query object (likely match_all)");
    assertEquals(0, emptyBuilder.from());
    assertEquals(10, emptyBuilder.size());

    // Test null query - should return a valid builder with a query
    var nullBuilder = osFactory.getSearchSourceBuilderV2("table", null, 0, 10);
    assertNotNull(nullBuilder, "Should handle null query");
    assertNotNull(nullBuilder.query(), "Null query should have a query object (likely match_all)");

    // Test wildcard query - should return a valid builder with a query
    var wildcardBuilder = osFactory.getSearchSourceBuilderV2("table", "*", 0, 10);
    assertNotNull(wildcardBuilder, "Should handle wildcard query");
    assertNotNull(
        wildcardBuilder.query(), "Wildcard query should have a query object (likely match_all)");
  }

  @Test
  public void testDataAssetIndexUsesCompositeConfiguration() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    String query = "test";

    // Get builders for comparison - dataAsset should use composite configuration
    var tableBuilder = osFactory.getSearchSourceBuilderV2("table", query, 0, 10);
    var dataAssetBuilder = osFactory.getSearchSourceBuilderV2("dataAsset", query, 0, 10);

    // Verify both builders are created successfully with queries
    assertNotNull(tableBuilder, "Table builder should not be null");
    assertNotNull(dataAssetBuilder, "DataAsset builder should not be null");
    assertNotNull(tableBuilder.query(), "Table query should not be null");
    assertNotNull(dataAssetBuilder.query(), "DataAsset query should not be null");

    // Verify dataAsset has aggregations (composite config should add entity type aggregations)
    assertNotNull(
        dataAssetBuilder.aggregations(), "DataAsset should have aggregations map initialized");
  }

  @Test
  public void testConsistencyBetweenIndexes() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    String query = "customer data";

    // Test that both specific index and generic index return valid builders
    var tableSpecificBuilder =
        osFactory.getSearchSourceBuilderV2("table_search_index", query, 0, 10);
    var tableBuilder = osFactory.getSearchSourceBuilderV2("table", query, 0, 10);

    // Verify both builders are created successfully with queries
    assertNotNull(tableSpecificBuilder, "Specific index builder should not be null");
    assertNotNull(tableBuilder, "Generic index builder should not be null");
    assertNotNull(tableSpecificBuilder.query(), "Specific index query should not be null");
    assertNotNull(tableBuilder.query(), "Generic index query should not be null");

    // Both should have same pagination parameters
    assertEquals(tableSpecificBuilder.from(), tableBuilder.from(), "Both should have same 'from'");
    assertEquals(tableSpecificBuilder.size(), tableBuilder.size(), "Both should have same 'size'");
  }
}
