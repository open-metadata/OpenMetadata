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

import es.co.elastic.clients.util.NamedValue;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Condition;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.Range;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.ElasticSearchRequestBuilder;
import org.openmetadata.service.search.elasticsearch.ElasticSearchSourceBuilderFactory;
import org.openmetadata.service.search.opensearch.OpenSearchRequestBuilder;
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
        .thenAnswer(invocation -> invocation.getArgument(0));

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
  public void testAggregateBuildersHandleMissingGlobalAggregations() {
    searchSettings.setDefaultConfiguration(null);

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder osAggregate =
        assertDoesNotThrow(() -> osFactory.buildAggregateSearchBuilderV2("customer", 0, 10));
    ElasticSearchRequestBuilder esAggregate =
        assertDoesNotThrow(() -> esFactory.buildAggregateSearchBuilderV2("customer", 0, 10));
    OpenSearchRequestBuilder osCommon =
        assertDoesNotThrow(() -> osFactory.buildCommonSearchBuilderV2("customer", 0, 10));
    ElasticSearchRequestBuilder esCommon =
        assertDoesNotThrow(() -> esFactory.buildCommonSearchBuilderV2("customer", 0, 10));

    assertNotNull(osAggregate.query());
    assertNotNull(esAggregate.query());
    assertNotNull(osCommon.query());
    assertNotNull(esCommon.query());
    assertTrue(osAggregate.aggregations().isEmpty());
    assertTrue(esAggregate.aggregations().isEmpty());
    assertTrue(osCommon.aggregations().isEmpty());
    assertTrue(esCommon.aggregations().isEmpty());
  }

  @Test
  public void testDataAssetBuildersApplyHighlightsAggregationsAndExplain() {
    searchSettings.getGlobalSettings().setMaxResultHits(25);
    searchSettings
        .getGlobalSettings()
        .setAggregations(List.of(createAggregation("owners", "owners.displayName")));
    searchSettings.getGlobalSettings().setHighlightFields(List.of("name"));
    tableConfig.setAggregations(List.of(createAggregation("service", "service.name")));
    tableConfig.setHighlightFields(List.of("displayName"));

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder osBuilder =
        osFactory.buildDataAssetSearchBuilderV2("table", "customer", 100, 50, true, true);
    ElasticSearchRequestBuilder esBuilder =
        esFactory.buildDataAssetSearchBuilderV2("table", "customer", 100, 50, true, true);

    assertEquals(25, osBuilder.from());
    assertEquals(25, osBuilder.size());
    assertEquals(25, esBuilder.from());
    assertEquals(25, esBuilder.size());
    assertEquals(Boolean.TRUE, osBuilder.explain());
    assertEquals(Boolean.TRUE, esBuilder.explain());
    assertEquals(Set.of("owners", "service"), osBuilder.aggregations().keySet());
    assertEquals(Set.of("owners", "service"), esBuilder.aggregations().keySet());
    assertHighlightFields(osBuilder, "displayName");
    assertHighlightFields(esBuilder, "displayName");

    OpenSearchRequestBuilder osWithoutAggregations =
        osFactory.buildDataAssetSearchBuilderV2("table", "customer", 0, 10, false, false);
    ElasticSearchRequestBuilder esWithoutAggregations =
        esFactory.buildDataAssetSearchBuilderV2("table", "customer", 0, 10, false, false);

    assertTrue(osWithoutAggregations.aggregations().isEmpty());
    assertTrue(esWithoutAggregations.aggregations().isEmpty());
    assertEquals(Boolean.FALSE, osWithoutAggregations.explain());
    assertEquals(Boolean.FALSE, esWithoutAggregations.explain());
    assertHighlightFields(osWithoutAggregations, "displayName");
    assertHighlightFields(esWithoutAggregations, "displayName");
  }

  @Test
  public void testElasticDataAssetBuilderHandlesMatchAllAndComplexSyntaxQueries() {
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    ElasticSearchRequestBuilder emptyBuilder =
        esFactory.buildDataAssetSearchBuilderV2("table", "", 0, 10, false, false);
    ElasticSearchRequestBuilder nullBuilder =
        esFactory.buildDataAssetSearchBuilderV2("table", null, 0, 10, false, false);
    ElasticSearchRequestBuilder wildcardBuilder =
        esFactory.buildDataAssetSearchBuilderV2("table", "*", 0, 10, false, false);
    ElasticSearchRequestBuilder complexBuilder =
        esFactory.buildDataAssetSearchBuilderV2(
            "table", "name:orders AND owner:alice", 0, 10, false, false);

    assertTrue(emptyBuilder.query().isFunctionScore());
    assertTrue(nullBuilder.query().isFunctionScore());
    assertTrue(wildcardBuilder.query().isFunctionScore());
    assertTrue(complexBuilder.query().isFunctionScore());
    assertTrue(emptyBuilder.aggregations().isEmpty());
    assertTrue(complexBuilder.aggregations().isEmpty());
  }

  @Test
  public void testDataAssetBuildersUseGlobalHighlightFallbackAndScriptAggregations() {
    searchSettings
        .getGlobalSettings()
        .setAggregations(
            List.of(createScriptAggregation("entityTypeScript", "doc['entityType'].value")));
    searchSettings.getGlobalSettings().setHighlightFields(List.of("name"));
    tableConfig.setHighlightFields(null);
    tableConfig.setAggregations(
        List.of(createScriptAggregation("serviceScript", "doc['service.name'].value")));

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder osBuilder =
        osFactory.buildDataAssetSearchBuilderV2("table", "orders", 0, 10, false, true);
    ElasticSearchRequestBuilder esBuilder =
        esFactory.buildDataAssetSearchBuilderV2("table", "orders", 0, 10, false, true);

    assertHighlightFields(osBuilder, "name");
    assertHighlightFields(esBuilder, "name");
    assertEquals(Set.of("entityTypeScript", "serviceScript"), osBuilder.aggregations().keySet());
    assertEquals(Set.of("entityTypeScript", "serviceScript"), esBuilder.aggregations().keySet());
  }

  @Test
  public void testSpecialIndexRoutingUsesExpectedBuilderFamilies() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder osDataQuality =
        osFactory.getSearchSourceBuilderV2("test_case_search_index", "status", 0, 10);
    ElasticSearchRequestBuilder esDataQuality =
        esFactory.getSearchSourceBuilderV2("test_case_search_index", "status", 0, 10);
    assertHighlightFields(osDataQuality, "testSuite.name", "testSuite.description");
    assertHighlightFields(esDataQuality, "testSuite.name", "testSuite.description");

    OpenSearchRequestBuilder osTimeSeries =
        osFactory.getSearchSourceBuilderV2("test_case_result_search_index", "passed", 0, 10);
    ElasticSearchRequestBuilder esTimeSeries =
        esFactory.getSearchSourceBuilderV2("test_case_result_search_index", "passed", 0, 10);
    assertNotNull(osTimeSeries.highlighter());
    assertNotNull(esTimeSeries.highlighter());
    assertTrue(osTimeSeries.highlighter().fields().isEmpty());
    assertTrue(esTimeSeries.highlighter().fields().isEmpty());

    OpenSearchRequestBuilder osCost =
        osFactory.getSearchSourceBuilderV2("raw_cost_analysis_report_data_index", "usage", 0, 10);
    ElasticSearchRequestBuilder esCost =
        esFactory.getSearchSourceBuilderV2("raw_cost_analysis_report_data_index", "usage", 0, 10);
    assertNull(osCost.highlighter());
    assertNull(esCost.highlighter());

    OpenSearchRequestBuilder osService =
        osFactory.getSearchSourceBuilderV2("database_service_search_index", "snowflake", 0, 10);
    ElasticSearchRequestBuilder esService =
        esFactory.getSearchSourceBuilderV2("database_service_search_index", "snowflake", 0, 10);
    assertNotNull(osService.highlighter());
    assertNotNull(esService.highlighter());
    assertTrue(osService.highlighter().fields().isEmpty());
    assertTrue(esService.highlighter().fields().isEmpty());

    OpenSearchRequestBuilder osUser = osFactory.getSearchSourceBuilderV2("user", "alice", 0, 10);
    ElasticSearchRequestBuilder esUser = esFactory.getSearchSourceBuilderV2("user", "alice", 0, 10);
    assertNull(osUser.highlighter());
    assertNull(esUser.highlighter());
  }

  @Test
  public void testBoostedSearchBuildersProduceFunctionScoreQueries() {
    searchSettings
        .getGlobalSettings()
        .setAggregations(List.of(createAggregation("entityType", "entityType")));
    searchSettings
        .getGlobalSettings()
        .setTermBoosts(List.of(createTermBoost("tier.tagFQN", "Tier.Tier1", 3.0)));
    searchSettings
        .getGlobalSettings()
        .setFieldValueBoosts(
            List.of(
                createFieldValueBoost(
                    "usageSummary.weeklyStats.count",
                    1.2,
                    FieldValueBoost.Modifier.LOG_1_P,
                    0.0,
                    new Range().withGte(10.0))));
    tableConfig.setTermBoosts(List.of(createTermBoost("entityType", "table", 2.0)));
    tableConfig.setFieldValueBoosts(
        List.of(
            createFieldValueBoost(
                "usageSummary.weeklyStats.count",
                1.5,
                FieldValueBoost.Modifier.SQRT,
                1.0,
                new Range().withLt(100.0))));

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder osCommon = osFactory.buildCommonSearchBuilderV2("customer", 0, 10);
    ElasticSearchRequestBuilder esCommon = esFactory.buildCommonSearchBuilderV2("customer", 0, 10);
    OpenSearchRequestBuilder osEntitySpecific =
        osFactory.buildEntitySpecificAggregateSearchBuilderV2("customer", 0, 10);
    ElasticSearchRequestBuilder esEntitySpecific =
        esFactory.buildEntitySpecificAggregateSearchBuilderV2("customer", 0, 10);

    assertTrue(osCommon.query().isFunctionScore());
    assertTrue(esCommon.query().isFunctionScore());
    assertTrue(osEntitySpecific.query().isFunctionScore());
    assertTrue(esEntitySpecific.query().isFunctionScore());
    assertEquals(Set.of("entityType"), osEntitySpecific.aggregations().keySet());
    assertEquals(Set.of("entityType"), esEntitySpecific.aggregations().keySet());
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

  private Aggregation createAggregation(String name, String field) {
    return new Aggregation().withName(name).withField(field);
  }

  private Aggregation createScriptAggregation(String name, String script) {
    return new Aggregation().withName(name).withScript(script);
  }

  private TermBoost createTermBoost(String field, String value, Double boost) {
    return new TermBoost().withField(field).withValue(value).withBoost(boost);
  }

  private FieldValueBoost createFieldValueBoost(
      String field, Double factor, FieldValueBoost.Modifier modifier, Double missing, Range range) {
    return new FieldValueBoost()
        .withField(field)
        .withFactor(factor)
        .withModifier(modifier)
        .withMissing(missing)
        .withCondition(new Condition().withRange(range));
  }

  private void assertHighlightFields(OpenSearchRequestBuilder builder, String... expectedFields) {
    assertNotNull(builder.highlighter());
    assertEquals(Set.copyOf(List.of(expectedFields)), builder.highlighter().fields().keySet());
  }

  private void assertHighlightFields(
      ElasticSearchRequestBuilder builder, String... expectedFields) {
    assertNotNull(builder.highlighter());
    assertEquals(
        Set.copyOf(List.of(expectedFields)),
        Set.copyOf(builder.highlighter().fields().stream().map(NamedValue::name).toList()));
  }
}
