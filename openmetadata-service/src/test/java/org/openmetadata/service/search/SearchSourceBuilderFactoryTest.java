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
import jakarta.json.stream.JsonGenerator;
import java.io.IOException;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Condition;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.Range;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchRequestBuilder;
import org.openmetadata.service.search.elasticsearch.ElasticSearchSourceBuilderFactory;
import org.openmetadata.service.search.opensearch.OpenSearchRequestBuilder;
import org.openmetadata.service.search.opensearch.OpenSearchSourceBuilderFactory;
import org.openmetadata.service.util.EntityUtil;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;

public class SearchSourceBuilderFactoryTest {

  private static final String FUZZY_STAGE_QUERY_NAME = "ranking:fuzzyName";
  private static final String CLOSE_NAME_STAGE_QUERY_NAME = "ranking:closeName";
  private static final String PREFIX_STAGE_QUERY_NAME = "ranking:prefixName";
  private static final String INDEX_DATA_ASSET = "dataAsset";

  /** fuzzyName, partialName, structuralContext and descriptionContext from searchSettings.json. */
  private static final int TEXT_RANKING_STAGE_COUNT = 4;

  private static final List<Double> TEXT_RANKING_STAGE_WEIGHTS = List.of(24.0, 16.0, 12.0, 4.0);

  /**
   * The ranking stages under test are defined in the shipped searchSettings.json, not in the
   * hand-built fixture below — a fixture without them silently exercises the unranked legacy path,
   * so assertions on ranking stages would pass vacuously. Loaded once per class because resolving
   * it scans the classpath; the source builders only read it.
   */
  private static SearchSettings shippedSearchSettings;

  private SearchSettings searchSettings;
  private AssetTypeConfiguration tableConfig;
  private AssetTypeConfiguration topicConfig;
  private AssetTypeConfiguration contextFileConfig;
  private AssetTypeConfiguration defaultConfig;

  @BeforeAll
  public static void loadShippedSearchSettings() throws IOException {
    List<String> jsonDataFiles =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(
            EntityRepository.class.getClassLoader(), jsonDataFiles.getFirst());
    shippedSearchSettings = JsonUtils.readValue(json, SearchSettings.class);
  }

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

    contextFileConfig = new AssetTypeConfiguration();
    contextFileConfig.setAssetType(Entity.CONTEXT_FILE);
    contextFileConfig.setSearchFields(
        List.of(
            createFieldBoost("name.ngram", 1.0, "fuzzy"),
            createFieldBoost("extractedText", 3.0, "standard")));

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
    assetConfigs.add(contextFileConfig);
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
  public void testContextFileSearchUsesExtractedTextConfiguration() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    OpenSearchRequestBuilder osBuilder =
        osFactory.getSearchSourceBuilderV2("context_file_search_index", "needle", 0, 10);
    ElasticSearchRequestBuilder esBuilder =
        esFactory.getSearchSourceBuilderV2("context_file_search_index", "needle", 0, 10);

    String osQuery = osBuilder.query().toJsonString();
    String esQuery = esBuilder.query().toString();
    assertTrue(osQuery.contains("extractedText"), osQuery);
    assertTrue(esQuery.contains("extractedText"), esQuery);
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
  public void testQuerySyntaxDetectionHandlesLongMalformedQueries() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);

    List.of(
            "owner:john",
            "name : test",
            "name:test AND type:table",
            "description:\"exact phrase\"",
            "[a TO z]",
            "-deprecated",
            "(-deprecated)",
            "(+certified)",
            "name:-deprecated",
            "status:+active",
            "customer -orders",
            "*PII*",
            "\\\\".repeat(5000) + "*")
        .forEach(query -> assertTrue(osFactory.containsQuerySyntax(query)));

    List.of(
            "customer order",
            "customer-orders",
            "\"customer orders\"",
            "[".repeat(5000),
            "[a TO " + " ".repeat(5000),
            "a".repeat(5000),
            "\\\\".repeat(5000),
            "\\\\".repeat(5000) + "\\*")
        .forEach(query -> assertFalse(osFactory.containsQuerySyntax(query)));

    List.of(
            "customer\\-orders",
            "name\\:test",
            "name\\:-deprecated",
            "\\\"customer orders\\\"",
            "orders\\(daily\\)",
            "\\(-deprecated",
            "\\[a TO z\\]")
        .forEach(query -> assertFalse(osFactory.containsQuerySyntax(query)));
  }

  @Test
  public void testRankedQueriesUseUnescapedPlainText() {
    defaultConfig.setRanking(
        new RankingConfiguration()
            .withEnabled(true)
            .withStages(
                List.of(
                    new RankingStage()
                        .withName("exactName")
                        .withFields(List.of("fullyQualifiedName"))
                        .withMatchType(RankingStage.MatchType.EXACT)
                        .withWeight(32.0))));

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);
    String escapedFqn = "pw\\-ml\\-model\\-service.pw\\-mlmodel";

    String osQuery =
        serializeOpenSearchRequest(
            osFactory.buildDataAssetSearchBuilderV2("all", escapedFqn, 0, 10, false, false));
    String esQuery =
        esFactory
            .buildDataAssetSearchBuilderV2("all", escapedFqn, 0, 10, false, false)
            .query()
            .toString();

    assertTrue(osQuery.contains("pw-ml-model-service.pw-mlmodel"), osQuery);
    assertTrue(esQuery.contains("pw-ml-model-service.pw-mlmodel"), esQuery);
    assertFalse(osQuery.contains("\\\\-"), osQuery);
    assertFalse(esQuery.contains("\\\\-"), esQuery);
  }

  @Test
  public void testTokenCoverageRequiresAllAnalyzedSubTermsWithinEachQueryToken() {
    defaultConfig.setRanking(
        new RankingConfiguration()
            .withEnabled(true)
            .withStages(
                List.of(
                    new RankingStage()
                        .withName("closeName")
                        .withFields(List.of("name.compound"))
                        .withMatchType(RankingStage.MatchType.TOKEN_COVERAGE)
                        .withMinimumShouldMatch("2<70%"))));

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    String osQuery =
        serializeOpenSearchRequest(
            osFactory.buildDataAssetSearchBuilderV2("table", "N0NExistent", 0, 10, false, false));
    String esQuery =
        esFactory
            .buildDataAssetSearchBuilderV2("table", "N0NExistent", 0, 10, false, false)
            .query()
            .toString();

    assertTrue(osQuery.contains("\"operator\":\"and\""), osQuery);
    assertTrue(esQuery.contains("\"operator\":\"and\""), esQuery);
  }

  @Test
  public void testColumnIndexUsesStructuredDataAssetBuilder() {
    // Regression for the Explore column count-vs-results mismatch: index=tableColumn must go
    // through the structured data-asset builder (operator AND over fqnParts) so an FQN query
    // matches the one column precisely. The old permissive OR multi_match had no fqnParts and
    // matched every column that shared a parent-name token (returned the whole index).
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    String osQuery =
        serializeOpenSearchRequest(
            osFactory.getSearchSourceBuilderV2("tableColumn", "customer orders", 0, 15));
    String esQuery =
        esFactory
            .getSearchSourceBuilderV2("tableColumn", "customer orders", 0, 15)
            .query()
            .toString();

    assertTrue(osQuery.contains("fqnParts"), osQuery);
    assertTrue(osQuery.contains("\"operator\":\"and\""), osQuery);
    assertTrue(esQuery.contains("fqnParts"), esQuery);
    assertTrue(esQuery.contains("\"operator\":\"and\""), esQuery);
  }

  @Test
  public void testIdentifierQueryStillBuildsTheFuzzyStage() {
    // Recall is not narrowed at query-build time. Dropping the stage here is what cost mid-type
    // autocomplete and one-char typo tolerance (SearchResourceIT#testDataAssetAliasSearchMatrix),
    // because for a single-term identifier getFuzziness() already reports 0 and the gate then fired
    // on essentially every entity name. Precision for an identifier lookup is recovered after the
    // search instead — see SearchRankingHelper#isExactIdentifierLookup — which can tell a real
    // identifier from a half-typed one, as the query text alone cannot.
    String columnFqn = "svc_a.db_a.schema_a.table_a.user_id";

    assertTrue(rankedOpenSearchQuery(columnFqn).contains(FUZZY_STAGE_QUERY_NAME));
    assertTrue(rankedElasticSearchQuery(columnFqn).contains(FUZZY_STAGE_QUERY_NAME));
  }

  @Test
  public void testMultiTermQueryKeepsTheFuzzyStage() {
    // The narrowing above is scoped to single-term identifier lookups. A multi-word search still
    // needs the fuzzy stage's partial token coverage across terms, so it must survive there.
    String phrase = "sample_data table";
    String osQuery = rankedOpenSearchQuery(phrase);
    String esQuery = rankedElasticSearchQuery(phrase);

    assertTrue(osQuery.contains(FUZZY_STAGE_QUERY_NAME), osQuery);
    assertTrue(esQuery.contains(FUZZY_STAGE_QUERY_NAME), esQuery);
  }

  @Test
  public void testShortQueryKeepsRealTypoTolerance() {
    // Fuzziness is only disabled past two sub-tokens; a short name search keeps both the stage and
    // a non-zero fuzziness, which is the stage's documented purpose.
    String osQuery = rankedOpenSearchQuery("custmer");
    String esQuery = rankedElasticSearchQuery("custmer");

    assertTrue(osQuery.contains(FUZZY_STAGE_QUERY_NAME), osQuery);
    assertTrue(esQuery.contains(FUZZY_STAGE_QUERY_NAME), esQuery);
  }

  @Test
  public void testTextRankingStagesAreBoundedByTheirWeight() {
    // exactName/phraseName/closeName are constant_score, so their score is exactly their weight.
    // The text stages must be saturated to stay inside theirs; boosting the multi_match by the
    // weight instead makes the stage BM25 x weight, which is unbounded and lets fuzzyName (24)
    // outscore exactName's ceiling of 100.
    String osQuery = rankedTableOpenSearchQuery("customers");
    String esQuery = rankedTableElasticSearchQuery("customers");

    for (String queryJson : List.of(osQuery, esQuery)) {
      assertTrue(queryJson.contains(SearchRankingHelper.STAGE_SATURATION_SCRIPT), queryJson);
      assertEquals(
          TEXT_RANKING_STAGE_COUNT,
          countOccurrences(queryJson, SearchRankingHelper.STAGE_SATURATION_SCRIPT),
          "every text ranking stage must be saturated: " + queryJson);
      for (double weight : TEXT_RANKING_STAGE_WEIGHTS) {
        assertTrue(
            queryJson.contains("\"weight\":" + weight),
            "expected a saturated stage of weight " + weight + " in " + queryJson);
      }
    }
  }

  @Test
  public void testSaturatedTextStagesKeepTheirRankingQueryName() {
    // The Ranking Details panel reads matched_queries, so wrapping a stage in script_score must
    // not drop the _name that identifies which stage matched.
    String osQuery = rankedTableOpenSearchQuery("customers");
    String esQuery = rankedTableElasticSearchQuery("customers");

    assertTrue(osQuery.contains(FUZZY_STAGE_QUERY_NAME + ":text"), osQuery);
    assertTrue(esQuery.contains(FUZZY_STAGE_QUERY_NAME + ":text"), esQuery);
  }

  @Test
  public void testPrefixStageCoversPartiallyTypedAndVeryShortQueries() {
    // om_ngram has a three character minimum and encodes no notion of "starts with", so a partly
    // typed name landed in the n-gram band ordered arbitrarily and anything shorter matched nothing
    // at all. match_bool_prefix gives prefixes their own band between phrase and close name.
    for (String queryJson :
        List.of(rankedTableOpenSearchQuery("cust"), rankedTableElasticSearchQuery("cust"))) {
      assertTrue(queryJson.contains("match_bool_prefix"), queryJson);
      assertTrue(queryJson.contains(PREFIX_STAGE_QUERY_NAME + ":name"), queryJson);
      assertTrue(queryJson.contains(PREFIX_STAGE_QUERY_NAME + ":displayName"), queryJson);
      assertTrue(queryJson.contains("\"boost\":55.0"), queryJson);
    }

    // Two characters is below the n-gram floor; the prefix stage still has to be built.
    assertTrue(rankedTableOpenSearchQuery("cu").contains("match_bool_prefix"));
    assertTrue(rankedTableElasticSearchQuery("cu").contains("match_bool_prefix"));
  }

  @Test
  public void testPrefixStageSkipsKeywordAndNgramSubFields() {
    // A prefix on a keyword field can only match the whole value, and prefixing an n-gram field
    // re-grams the query. Only the analyzed name fields belong in this stage.
    String queryJson = rankedTableOpenSearchQuery("cust");

    assertFalse(queryJson.contains(PREFIX_STAGE_QUERY_NAME + ":name.keyword"), queryJson);
    assertFalse(queryJson.contains(PREFIX_STAGE_QUERY_NAME + ":name.ngram"), queryJson);
    assertFalse(queryJson.contains(PREFIX_STAGE_QUERY_NAME + ":fullyQualifiedName"), queryJson);
  }

  @Test
  public void testIdentityStagesScoreTheirSingleBestField() {
    // displayName falls back to name, and name.compound now analyses like name, so the identity
    // stages restate one piece of evidence. A non-zero tie breaker adds a share of every extra
    // match, which let a longer name that matched more of those near-duplicate fields outrank the
    // name that was actually typed.
    for (String queryJson :
        List.of(
            rankedTableOpenSearchQuery("customers"), rankedTableElasticSearchQuery("customers"))) {
      String fuzzyStage = clauseContaining(queryJson, FUZZY_STAGE_QUERY_NAME + ":text");
      assertTrue(fuzzyStage.contains("\"tie_breaker\":0.0"), fuzzyStage);
      // A stage over genuinely distinct fields keeps the default.
      String structuralStage = clauseContaining(queryJson, "ranking:structuralContext:text");
      assertFalse(structuralStage.contains("\"tie_breaker\":0.0"), structuralStage);
    }
  }

  @Test
  public void testIdentityStagesKeepTheUnstemmedCompoundSubField() {
    // The base field is stemmed and the compound sub-field is not, and the fuzzy stage needs both:
    // kstem takes "customer" to "custom", so a typed "custmer" is three edits from the stemmed form
    // and reaches the document only through the compound field's literal "customer". Dropping the
    // sub-field as redundant removed typo tolerance for every word kstem shortens.
    String fuzzyStage =
        clauseContaining(rankedTableOpenSearchQuery("customers"), FUZZY_STAGE_QUERY_NAME + ":text");

    assertTrue(fuzzyStage.contains("name.compound"), fuzzyStage);
    assertTrue(fuzzyStage.contains("displayName.compound"), fuzzyStage);
    // The double counting that motivated dropping them is handled by the zero tie breaker.
    assertTrue(fuzzyStage.contains("\"tie_breaker\":0.0"), fuzzyStage);
  }

  @Test
  public void testEntityTypePriorIsAppliedAsASignal() {
    // The column index carries two orders of magnitude more documents than the table index, so
    // without a type prior a name that matches a column matches it many times over and the assets
    // that contain those columns get pushed off the first page.
    for (String queryJson :
        List.of(
            rankedTableOpenSearchQuery("customers"), rankedTableElasticSearchQuery("customers"))) {
      assertTrue(queryJson.contains("\"entityType\""), queryJson);
      assertTrue(queryJson.contains("\"value\":\"table\""), queryJson);
      assertTrue(queryJson.contains("\"value\":\"tableColumn\""), queryJson);
    }
  }

  @Test
  public void testStageFieldWeightsUseAConfigWideReference() {
    // Normalising against the stage's own maximum makes a field's weight depend on what it shares a
    // stage with: descriptionContext holds only description (boost 2 of 20) and was scoring it as
    // if it were a name field. Against a config-wide reference the low boost survives.
    String descriptionStage =
        clauseContaining(
            rankedTableOpenSearchQuery("customers"), "ranking:descriptionContext:text");

    assertTrue(descriptionStage.contains("description^0.8"), descriptionStage);
    assertFalse(descriptionStage.contains("description^1.25"), descriptionStage);
  }

  @Test
  public void testCompositeStageWeightsSurviveTheCrossEntityMerge() {
    // all/dataAsset merges every entity type's searchFields into one stage. While weights were
    // normalised against the merged maximum, one entity type boosting a niche field set the ceiling
    // for everyone and fqnParts - a primary structural signal - was demoted below it.
    OpenSearchSourceBuilderFactory factory =
        new OpenSearchSourceBuilderFactory(shippedSearchSettings);
    String queryJson =
        serializeOpenSearchRequest(
            factory.getSearchSourceBuilderV2(INDEX_DATA_ASSET, "customers", 0, 15));
    String structuralStage = clauseContaining(queryJson, "ranking:structuralContext:text");

    assertTrue(structuralStage.contains("fqnParts^0.875"), structuralStage);
    assertFalse(
        structuralStage.contains("^1.25"),
        "no field may be promoted to the top of the " + "band by the merge: " + structuralStage);
  }

  /** The smallest {@code {...}} object in {@code json} that contains {@code marker}. */
  private static String clauseContaining(String json, String marker) {
    int at = json.indexOf(marker);
    assertTrue(at >= 0, "expected " + marker + " in " + json);
    int start = at;
    int depth = 0;
    while (start > 0) {
      char c = json.charAt(start);
      if (c == '}') {
        depth++;
      } else if (c == '{') {
        if (depth == 0) {
          break;
        }
        depth--;
      }
      start--;
    }
    int end = at;
    depth = 0;
    while (end < json.length() - 1) {
      char c = json.charAt(end);
      if (c == '{') {
        depth++;
      } else if (c == '}') {
        if (depth == 0) {
          break;
        }
        depth--;
      }
      end++;
    }
    return json.substring(start, end + 1);
  }

  private static int countOccurrences(String haystack, String needle) {
    int count = 0;
    int index = haystack.indexOf(needle);
    while (index >= 0) {
      count++;
      index = haystack.indexOf(needle, index + needle.length());
    }
    return count;
  }

  private static String rankedTableOpenSearchQuery(String query) {
    OpenSearchSourceBuilderFactory factory =
        new OpenSearchSourceBuilderFactory(shippedSearchSettings);
    return serializeOpenSearchRequest(factory.getSearchSourceBuilderV2(Entity.TABLE, query, 0, 15));
  }

  private static String rankedTableElasticSearchQuery(String query) {
    ElasticSearchSourceBuilderFactory factory =
        new ElasticSearchSourceBuilderFactory(shippedSearchSettings);
    return factory.getSearchSourceBuilderV2(Entity.TABLE, query, 0, 15).query().toString();
  }

  private static String rankedOpenSearchQuery(String query) {
    OpenSearchSourceBuilderFactory factory =
        new OpenSearchSourceBuilderFactory(shippedSearchSettings);
    return serializeOpenSearchRequest(
        factory.getSearchSourceBuilderV2(Entity.TABLE_COLUMN, query, 0, 15));
  }

  private static String rankedElasticSearchQuery(String query) {
    ElasticSearchSourceBuilderFactory factory =
        new ElasticSearchSourceBuilderFactory(shippedSearchSettings);
    return factory.getSearchSourceBuilderV2(Entity.TABLE_COLUMN, query, 0, 15).query().toString();
  }

  private static String serializeOpenSearchRequest(OpenSearchRequestBuilder requestBuilder) {
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    StringWriter writer = new StringWriter();
    JsonGenerator generator = mapper.jsonProvider().createGenerator(writer);
    requestBuilder.build("table_search_index").serialize(generator, mapper);
    generator.close();
    return writer.toString();
  }

  /**
   * The data quality builders also serve {@code /v1/search/query} and {@code /v1/search/export},
   * whose {@code q} is a documented Lucene expression. Without {@code freeText} they must keep
   * {@code query_string}, or a field-scoped query silently becomes literal text and returns 0 hits
   * with HTTP 200.
   */
  @Test
  public void testDataQualitySearchPreservesLuceneSyntaxForSearchQueryEndpoint() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    String luceneExpression = "testSuite.name.keyword:my_suite AND NOT entityFQN:archived";

    String osQuery =
        osFactory
            .getSearchSourceBuilderV2("test_case_search_index", luceneExpression, 0, 10)
            .query()
            .toJsonString();
    String esQuery =
        esFactory
            .getSearchSourceBuilderV2("test_suite_search_index", luceneExpression, 0, 10)
            .query()
            .toString();

    for (String builtQuery : List.of(osQuery, esQuery)) {
      assertTrue(
          builtQuery.contains(luceneExpression),
          "Lucene syntax must reach the engine verbatim for /v1/search/query: " + builtQuery);
      assertTrue(
          builtQuery.contains("query_string"),
          "/v1/search/query must keep the Lucene parser: " + builtQuery);
      assertFalse(
          builtQuery.contains("simple_query_string"),
          "simple_query_string would make the Lucene expression literal: " + builtQuery);
    }
  }

  /**
   * The mirror of the above: the data quality list endpoints document {@code q} as free text, so
   * they must use the parser that cannot throw on user input. A pasted URL is the reproduction from
   * the original report.
   */
  @Test
  public void testDataQualitySearchUsesSimpleQueryStringForFreeText() {
    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    String pastedUrl = "https://localhost:8585/table/orders";

    String osQuery =
        osFactory
            .buildDataQualitySearchBuilderV2("test_case_search_index", pastedUrl, 0, 10, true)
            .query()
            .toJsonString();
    String esQuery =
        esFactory
            .buildDataQualitySearchBuilderV2("test_suite_search_index", pastedUrl, 0, 10, true)
            .query()
            .toString();

    for (String builtQuery : List.of(osQuery, esQuery)) {
      assertTrue(
          builtQuery.contains("simple_query_string"),
          "Free-text q must use the parser that never throws: " + builtQuery);
      assertFalse(
          builtQuery.contains("\"query_string\""),
          "query_string is what produced the query_shard_exception: " + builtQuery);
      assertTrue(
          builtQuery.contains(pastedUrl),
          "The term must reach the engine unmangled, with no escaping: " + builtQuery);
      assertTrue(
          builtQuery.contains("\"NONE\""),
          "flags=NONE is what makes reserved characters literal: " + builtQuery);
    }
  }

  /**
   * Substring matching used to come from the UI wrapping the term in {@code *…*}. With {@code q}
   * literal there is no wildcard, so the {@code *.substring} ngram fields are the only thing
   * matching mid-token; if they drop out of the field list, searching "alues" for
   * "column_values_to_be_between" silently stops working.
   */
  @Test
  public void testDataQualitySearchQueriesTheSubstringFields() {
    ElasticSearchSourceBuilderFactory esFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);

    String esQuery =
        esFactory
            .buildDataQualitySearchBuilderV2("test_case_search_index", "alues", 0, 10, true)
            .query()
            .toString();

    assertTrue(esQuery.contains("name.substring"), esQuery);
    assertTrue(esQuery.contains("displayName.substring"), esQuery);
    // The ngram fields are only precise because every gram of the query must match. Under the
    // default OR a 3-gram overlap would be enough, so "orders" would surface "border_check".
    assertTrue(
        esQuery.contains("\"operator\":\"and\""),
        "ngram matching must require all grams, or substring search becomes noisy: " + esQuery);
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
  public void testOpenSearchHighlightDropsFlattenedExtensionField() {
    // `extension` is flat_object on OpenSearch (no analyzer); highlighting it (or any extension.*
    // subfield) fails the whole shard with a 500. buildHighlightsV2 must drop those while keeping
    // the real analyzable fields. Regression guard for ExtensionHighlightSearchIT.
    tableConfig.setHighlightFields(List.of("name", "extension", "extension.foundry_rid"));

    OpenSearchSourceBuilderFactory osFactory = new OpenSearchSourceBuilderFactory(searchSettings);
    OpenSearchRequestBuilder osBuilder =
        osFactory.buildDataAssetSearchBuilderV2("table", "customer", 0, 10, false, false);

    assertHighlightFields(osBuilder, "name");
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
