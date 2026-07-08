package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static org.openmetadata.service.search.SearchUtils.getFuzziness;
import static org.openmetadata.service.search.SearchUtils.getMaxExpansions;
import static org.openmetadata.service.search.SearchUtils.isColumnIndex;
import static org.openmetadata.service.search.SearchUtils.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtils.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtils.isServiceIndex;
import static org.openmetadata.service.search.SearchUtils.isTimeSeriesIndex;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.CustomPropertySearchFields;
import org.openmetadata.service.search.SearchRankingHelper;
import org.openmetadata.service.search.SearchSourceBuilderFactory;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;
import org.openmetadata.service.search.indexes.TestCaseResultIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier;
import os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode;
import os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore;
import os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode;
import os.org.opensearch.client.opensearch._types.query_dsl.Operator;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType;
import os.org.opensearch.client.opensearch.core.search.Highlight;

@Slf4j
public class OpenSearchSourceBuilderFactory
    implements SearchSourceBuilderFactory<
        OpenSearchRequestBuilder, Query, Highlight, FunctionScore> {

  // Constants for duplicate literals
  private static final String MATCH_TYPE_EXACT = "exact";
  private static final String MATCH_TYPE_PHRASE = "phrase";
  private static final String MATCH_TYPE_FUZZY = "fuzzy";
  private static final String MATCH_TYPE_STANDARD = "standard";
  private static final String INDEX_ALL = "all";
  private static final String INDEX_DATA_ASSET = "dataAsset";

  // OpenSearch maps the `extension` custom-properties object as flat_object (OsUtils transforms
  // flattened -> flat_object). flat_object has no analyzer, so asking the highlighter to highlight
  // `extension` or any `extension.*` subfield throws "no associated analyzer" and fails the whole
  // shard (a 500 on the search). Elasticsearch tolerates it, so this guard is OpenSearch-only.
  private static final String FLATTENED_EXTENSION_FIELD = "extension";
  private static final String MINIMUM_SHOULD_MATCH = "2<70%";
  private static final float DEFAULT_TIE_BREAKER = 0.3f;
  private static final float DEFAULT_BOOST = 1.0f;
  private static final float FUNCTION_BOOST_FACTOR = 0.3f;
  private static final String RANKING_QUERY_PREFIX = "ranking:";

  private final SearchSettings searchSettings;

  // Cache the expensive composite configuration
  private volatile AssetTypeConfiguration cachedCompositeConfig = null;
  private volatile long cacheTimestamp = 0;
  private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  public OpenSearchSourceBuilderFactory(SearchSettings searchSettings) {
    this.searchSettings = searchSettings;
  }

  public SearchSettings getSearchSettings() {
    return searchSettings;
  }

  private AssetTypeConfiguration getAssetConfiguration(String indexName) {
    String resolvedIndex = Entity.getSearchRepository().getIndexNameWithoutAlias(indexName);
    if (resolvedIndex.equals(INDEX_ALL) || resolvedIndex.equals(INDEX_DATA_ASSET)) {
      return getOrBuildCompositeConfig(); // Use cached version!
    } else {
      return findAssetTypeConfig(indexName, searchSettings);
    }
  }

  private void classifyFields(
      AssetTypeConfiguration assetConfig,
      Map<String, Float> fuzzyFields,
      Map<String, Float> nonFuzzyFields) {
    if (assetConfig.getSearchFields() != null) {
      for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
        String field = fieldBoost.getField();
        float boost = fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : 1.0f;

        if (isFuzzyField(field)) {
          fuzzyFields.put(field, boost);
        }
        if (isNonFuzzyField(field)) {
          nonFuzzyFields.put(field, boost);
        }
      }
    }
  }

  private static class MatchTypeMultipliers {
    float exactMatch = 2.0f;
    float phraseMatch = 1.5f;
    float fuzzyMatch = 1.0f;
  }

  private MatchTypeMultipliers getMatchTypeMultipliers(AssetTypeConfiguration assetConfig) {
    MatchTypeMultipliers multipliers = new MatchTypeMultipliers();
    if (assetConfig.getMatchTypeBoostMultipliers() != null) {
      if (assetConfig.getMatchTypeBoostMultipliers().getExactMatchMultiplier() != null) {
        multipliers.exactMatch =
            assetConfig.getMatchTypeBoostMultipliers().getExactMatchMultiplier().floatValue();
      }
      if (assetConfig.getMatchTypeBoostMultipliers().getPhraseMatchMultiplier() != null) {
        multipliers.phraseMatch =
            assetConfig.getMatchTypeBoostMultipliers().getPhraseMatchMultiplier().floatValue();
      }
      if (assetConfig.getMatchTypeBoostMultipliers().getFuzzyMatchMultiplier() != null) {
        multipliers.fuzzyMatch =
            assetConfig.getMatchTypeBoostMultipliers().getFuzzyMatchMultiplier().floatValue();
      }
    }
    return multipliers;
  }

  private Map<String, Map<String, Float>> groupFieldsByMatchType(
      AssetTypeConfiguration assetConfig) {
    Map<String, Map<String, Float>> fieldsByType =
        Map.of(
            MATCH_TYPE_EXACT, new HashMap<>(),
            MATCH_TYPE_PHRASE, new HashMap<>(),
            MATCH_TYPE_FUZZY, new HashMap<>(),
            MATCH_TYPE_STANDARD, new HashMap<>());

    if (assetConfig.getSearchFields() != null) {
      assetConfig
          .getSearchFields()
          .forEach(
              fieldBoost -> {
                String matchType =
                    fieldBoost.getMatchType() != null
                        ? fieldBoost.getMatchType().value()
                        : MATCH_TYPE_STANDARD;
                float boost =
                    fieldBoost.getBoost() != null
                        ? fieldBoost.getBoost().floatValue()
                        : DEFAULT_BOOST;
                fieldsByType.get(matchType).put(fieldBoost.getField(), boost);
              });
    }
    return fieldsByType;
  }

  private AssetTypeConfiguration getOrCreateDefaultConfig() {
    AssetTypeConfiguration defaultConfig = searchSettings.getDefaultConfiguration();
    if (defaultConfig == null) {
      defaultConfig = new AssetTypeConfiguration();
      defaultConfig.setAssetType("all");
    }
    return defaultConfig;
  }

  private AssetTypeConfiguration getOrBuildCompositeConfig() {
    long now = System.currentTimeMillis();
    if (cachedCompositeConfig == null || (now - cacheTimestamp) > CACHE_TTL_MS) {
      synchronized (this) {
        // Double-check after acquiring lock
        if (cachedCompositeConfig == null || (now - cacheTimestamp) > CACHE_TTL_MS) {
          cachedCompositeConfig = buildCompositeAssetConfig(searchSettings);
          cacheTimestamp = now;
          LOG.debug("Rebuilt composite asset configuration cache");
        }
      }
    }
    return cachedCompositeConfig;
  }

  private AssetTypeConfiguration buildCompositeAssetConfig(SearchSettings searchSettings) {
    AssetTypeConfiguration compositeConfig = new AssetTypeConfiguration();
    compositeConfig.setAssetType("all");

    List<FieldBoost> allFields = new ArrayList<>();
    List<TermBoost> allTermBoosts = new ArrayList<>();
    List<FieldValueBoost> allFieldValueBoosts = new ArrayList<>();

    for (AssetTypeConfiguration config : searchSettings.getAssetTypeConfigurations()) {
      if (config.getSearchFields() != null) {
        allFields.addAll(config.getSearchFields());
      }
      if (config.getTermBoosts() != null) {
        allTermBoosts.addAll(config.getTermBoosts());
      }
      if (config.getFieldValueBoosts() != null) {
        allFieldValueBoosts.addAll(config.getFieldValueBoosts());
      }
    }

    // Remove duplicates by field name, keeping the first occurrence
    Map<String, FieldBoost> uniqueFields = new LinkedHashMap<>();
    for (FieldBoost field : allFields) {
      uniqueFields.putIfAbsent(field.getField(), field);
    }

    compositeConfig.setSearchFields(new ArrayList<>(uniqueFields.values()));
    compositeConfig.setTermBoosts(allTermBoosts);
    compositeConfig.setFieldValueBoosts(allFieldValueBoosts);
    compositeConfig.setScoreMode(AssetTypeConfiguration.ScoreMode.SUM);
    compositeConfig.setBoostMode(AssetTypeConfiguration.BoostMode.MULTIPLY);

    return compositeConfig;
  }

  private Map<String, Float> extractAllFields(AssetTypeConfiguration assetConfig) {
    Map<String, Float> allFields = new HashMap<>();
    if (assetConfig.getSearchFields() != null) {
      assetConfig
          .getSearchFields()
          .forEach(
              fieldBoost -> {
                float boost =
                    fieldBoost.getBoost() != null
                        ? fieldBoost.getBoost().floatValue()
                        : DEFAULT_BOOST;
                allFields.put(fieldBoost.getField(), boost);
              });
    }
    return allFields;
  }

  public Query buildSearchQueryBuilderV2(String query, Map<String, Float> fields) {
    Map<String, Float> fuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    Map<String, Float> nonFuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isNonFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    Query fuzzyQuery =
        OpenSearchQueryBuilder.queryStringQuery(
            query,
            fuzzyFields,
            Operator.And,
            "1",
            10,
            3,
            DEFAULT_TIE_BREAKER,
            TextQueryType.MostFields);

    Query nonFuzzyQuery =
        OpenSearchQueryBuilder.multiMatchQuery(
            query,
            nonFuzzyFields,
            TextQueryType.MostFields,
            Operator.And,
            String.valueOf(DEFAULT_TIE_BREAKER),
            "0");

    return OpenSearchQueryBuilder.boolQuery()
        .should(fuzzyQuery)
        .should(nonFuzzyQuery)
        .minimumShouldMatch(1)
        .build();
  }

  public OpenSearchRequestBuilder searchBuilderV2(
      Query query, Highlight highlightBuilder, int fromOffset, int size) {
    OpenSearchRequestBuilder builder = new OpenSearchRequestBuilder();
    builder.query(query);
    if (highlightBuilder != null) {
      builder.highlighter(highlightBuilder);
    }
    builder.from(fromOffset);
    builder.size(size);
    return builder;
  }

  public OpenSearchRequestBuilder buildUserOrTeamSearchBuilderV2(String query, int from, int size) {
    Query queryBuilder = buildSearchQueryBuilderV2(query, UserIndex.getFields());
    return searchBuilderV2(queryBuilder, null, from, size);
  }

  public OpenSearchRequestBuilder getSearchSourceBuilderV2(
      String indexName, String searchQuery, int fromOffset, int size, boolean includeExplain) {
    return getSearchSourceBuilderV2(indexName, searchQuery, fromOffset, size, includeExplain, true);
  }

  public OpenSearchRequestBuilder getSearchSourceBuilderV2(
      String indexName,
      String searchQuery,
      int fromOffset,
      int size,
      boolean includeExplain,
      boolean includeAggregations) {
    indexName = Entity.getSearchRepository().getIndexNameWithoutAlias(indexName);

    if (isTimeSeriesIndex(indexName)) {
      return buildTimeSeriesSearchBuilderV2(indexName, searchQuery, fromOffset, size);
    }

    if (isColumnIndex(indexName)) {
      return buildColumnSearchBuilderV2(searchQuery, fromOffset, size);
    }

    if (isServiceIndex(indexName)) {
      return buildServiceSearchBuilderV2(searchQuery, fromOffset, size);
    }

    if (isDataQualityIndex(indexName)) {
      return buildDataQualitySearchBuilderV2(indexName, searchQuery, fromOffset, size);
    }

    if (isDataAssetIndex(indexName)) {
      return buildDataAssetSearchBuilderV2(
          indexName, searchQuery, fromOffset, size, includeExplain, includeAggregations);
    }

    if (indexName.equals("all") || indexName.equals("dataAsset")) {
      return buildDataAssetSearchBuilderV2(
          indexName, searchQuery, fromOffset, size, includeExplain, includeAggregations);
    }

    return switch (indexName) {
      case "user_search_index",
          "user",
          "team_search_index",
          "team" -> buildUserOrTeamSearchBuilderV2(searchQuery, fromOffset, size);
      case "context_memory_search_index", "contextMemory" -> buildContextMemorySearchBuilderV2(
          searchQuery, fromOffset, size);
      default -> buildAggregateSearchBuilderV2(searchQuery, fromOffset, size, includeAggregations);
    };
  }

  public OpenSearchRequestBuilder buildTestCaseSearchV2(String query, int from, int size) {
    Query queryBuilder = buildSearchQueryBuilderV2(query, TestCaseIndex.getFields());
    Highlight highlighter = buildHighlightsV2(List.of("testSuite.name", "testSuite.description"));
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildCostAnalysisReportDataSearchV2(
      String query, int from, int size) {
    Query queryBuilder = OpenSearchQueryBuilder.queryStringQuery(query);
    return searchBuilderV2(queryBuilder, null, from, size);
  }

  public OpenSearchRequestBuilder buildTestCaseResolutionStatusSearchV2(
      String query, int from, int size) {
    Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseResolutionStatusIndex.getFields());
    Highlight highlighter = buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildTestCaseResultSearchV2(String query, int from, int size) {
    Query queryBuilder = buildSearchQueryBuilderV2(query, TestCaseResultIndex.getFields());
    Highlight highlighter = buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildColumnSearchBuilderV2(String query, int from, int size) {
    Query queryBuilder;
    if (nullOrEmpty(query) || "*".equals(query.trim())) {
      queryBuilder = Query.of(q -> q.matchAll(m -> m));
    } else {
      Map<String, Float> fields = ColumnSearchIndex.getFields();
      queryBuilder =
          OpenSearchQueryBuilder.multiMatchQuery(
              query,
              fields,
              TextQueryType.BestFields,
              Operator.Or,
              String.valueOf(DEFAULT_TIE_BREAKER),
              "0");
    }
    Highlight highlighter = buildHighlightsV2(List.of("name", "displayName", "description"));
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildServiceSearchBuilderV2(String query, int from, int size) {
    Query queryBuilder = buildSearchQueryBuilderV2(query, SearchIndex.getDefaultFields());
    Highlight highlighter = buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildContextMemorySearchBuilderV2(
      String query, int from, int size) {
    Query queryBuilder = buildSearchQueryBuilderV2(query, ContextMemoryIndex.getFields());
    Highlight highlighter = buildHighlightsV2(List.of("title", "summary", "question", "answer"));
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildAggregateSearchBuilderV2(String query, int from, int size) {
    return buildAggregateSearchBuilderV2(query, from, size, true);
  }

  @Override
  public OpenSearchRequestBuilder buildAggregateSearchBuilderV2(
      String query, int from, int size, boolean includeAggregations) {
    AssetTypeConfiguration compositeConfig = getOrBuildCompositeConfig();
    Query baseQuery = buildQueryWithMatchTypesV2(query, compositeConfig);
    Query finalQuery = applyFunctionScoringV2(baseQuery, compositeConfig);

    OpenSearchRequestBuilder searchRequestBuilder = searchBuilderV2(finalQuery, null, from, size);
    if (includeAggregations) {
      addAggregationV2(searchRequestBuilder);
    }
    return searchRequestBuilder;
  }

  public OpenSearchRequestBuilder buildDataAssetSearchBuilderV2(
      String indexName, String query, int from, int size, boolean explain) {
    return buildDataAssetSearchBuilderV2(indexName, query, from, size, explain, true);
  }

  @Override
  public OpenSearchRequestBuilder buildDataAssetSearchBuilderV2(
      String indexName,
      String query,
      int from,
      int size,
      boolean explain,
      boolean includeAggregations) {
    AssetTypeConfiguration assetConfig = getAssetConfiguration(indexName);
    Query baseQuery = buildBaseQueryV2(query, assetConfig);
    Query finalQuery = applyFunctionScoringV2(baseQuery, assetConfig);
    Highlight highlightBuilder = buildHighlightingIfNeededV2(query, assetConfig);

    OpenSearchRequestBuilder searchRequestBuilder =
        createSearchSourceBuilderV2(finalQuery, from, size);
    if (highlightBuilder != null) {
      searchRequestBuilder.highlighter(highlightBuilder);
    }

    if (includeAggregations) {
      addConfiguredAggregationsV2(searchRequestBuilder, assetConfig);
    }
    searchRequestBuilder.explain(explain);

    return searchRequestBuilder;
  }

  private Query buildBaseQueryV2(String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return OpenSearchQueryBuilder.boolQuery()
          .must(OpenSearchQueryBuilder.matchAllQuery())
          .build();
    } else if (containsQuerySyntax(query)) {
      return buildComplexSyntaxQueryV2(query, assetConfig);
    } else {
      return buildSimpleQueryV2(query, assetConfig);
    }
  }

  private Query buildQueryWithMatchTypesV2(String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return OpenSearchQueryBuilder.boolQuery()
          .must(OpenSearchQueryBuilder.matchAllQuery())
          .build();
    }

    if (containsQuerySyntax(query)) {
      return buildComplexQueryV2(query, assetConfig);
    }

    return buildSimpleQueryWithTypesV2(query, assetConfig);
  }

  private Query buildComplexQueryV2(String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> allFields = extractAllFields(assetConfig);

    Query queryStringBuilder =
        OpenSearchQueryBuilder.queryStringQuery(
            query, allFields, Operator.And, null, 50, 0, 0.5, TextQueryType.MostFields);

    return OpenSearchQueryBuilder.boolQuery().must(queryStringBuilder).build();
  }

  private Query buildSimpleQueryWithTypesV2(String query, AssetTypeConfiguration assetConfig) {
    RankingConfiguration ranking = SearchRankingHelper.resolveRanking(searchSettings, assetConfig);
    if (ranking != null) {
      return buildRankedSimpleQueryV2(query, assetConfig, ranking);
    }

    OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery = OpenSearchQueryBuilder.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByType = groupFieldsByMatchType(assetConfig);

    addMatchTypeQueriesV2(combinedQuery, query, fieldsByType, multipliers);
    addCustomPropertyMatchQueriesV2(combinedQuery, query, assetConfig);

    combinedQuery.minimumShouldMatch(1);
    return OpenSearchQueryBuilder.boolQuery().must(combinedQuery.build()).build();
  }

  private void addMatchTypeQueriesV2(
      OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Map<String, Float>> fieldsByType,
      MatchTypeMultipliers multipliers) {

    addExactMatchQueriesV2(
        combinedQuery, query, fieldsByType.get(MATCH_TYPE_EXACT), multipliers.exactMatch);
    addPhraseMatchQueriesV2(
        combinedQuery, query, fieldsByType.get(MATCH_TYPE_PHRASE), multipliers.phraseMatch);
    addFuzzyMatchQueriesV2(
        combinedQuery, query, fieldsByType.get(MATCH_TYPE_FUZZY), multipliers.fuzzyMatch);
    addStandardMatchQueriesV2(combinedQuery, query, fieldsByType.get(MATCH_TYPE_STANDARD));
  }

  private Query applyFunctionScoringV2(Query baseQuery, AssetTypeConfiguration assetConfig) {
    List<FunctionScore> functions = collectBoostFunctionsV2(assetConfig);

    if (functions.isEmpty()) {
      return baseQuery;
    }

    RankingConfiguration ranking = SearchRankingHelper.resolveRanking(searchSettings, assetConfig);
    String scoreModeValue =
        assetConfig.getScoreMode() != null ? assetConfig.getScoreMode().value() : "sum";
    String boostModeValue =
        assetConfig.getBoostMode() != null ? assetConfig.getBoostMode().value() : "sum";
    FunctionScoreMode scoreMode =
        toScoreModeV2(SearchRankingHelper.signalScoreMode(ranking, scoreModeValue));
    FunctionBoostMode boostMode =
        toBoostModeV2(SearchRankingHelper.signalBoostMode(ranking, boostModeValue));

    return OpenSearchQueryBuilder.functionScoreQuery(
        baseQuery,
        functions,
        scoreMode,
        boostMode,
        FUNCTION_BOOST_FACTOR,
        SearchRankingHelper.signalMaxBoost(ranking));
  }

  private List<FunctionScore> collectBoostFunctionsV2(AssetTypeConfiguration assetConfig) {
    List<FunctionScore> functions = new ArrayList<>();

    // Add baseline weight of 1.0 so that assets with no tier/usage retain their text score
    // when boostMode is multiply. Without this, function_score could be 0 and zero out the
    // text relevance score.
    functions.add(
        OpenSearchQueryBuilder.weightFunction(OpenSearchQueryBuilder.matchAllQuery(), 1.0));

    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      searchSettings.getGlobalSettings().getTermBoosts().stream()
          .map(this::buildTermBoostFunctionV2)
          .forEach(functions::add);
    }
    if (assetConfig.getTermBoosts() != null) {
      assetConfig.getTermBoosts().stream()
          .map(this::buildTermBoostFunctionV2)
          .forEach(functions::add);
    }
    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      searchSettings.getGlobalSettings().getFieldValueBoosts().stream()
          .map(this::buildFieldValueBoostFunctionV2)
          .forEach(functions::add);
    }
    if (assetConfig.getFieldValueBoosts() != null) {
      assetConfig.getFieldValueBoosts().stream()
          .map(this::buildFieldValueBoostFunctionV2)
          .forEach(functions::add);
    }

    return functions;
  }

  private FunctionScore buildTermBoostFunctionV2(TermBoost tb) {
    Query filter = OpenSearchQueryBuilder.termQuery(tb.getField(), tb.getValue());
    return OpenSearchQueryBuilder.weightFunction(filter, tb.getBoost());
  }

  private FunctionScore buildFieldValueBoostFunctionV2(FieldValueBoost fvb) {
    Query condition = buildConditionQueryV2(fvb);

    FieldValueFactorModifier modifier = toFieldValueFactorModifierV2(fvb.getModifier());

    return OpenSearchQueryBuilder.fieldValueFactorFunction(
        condition,
        fvb.getField(),
        fvb.getFactor() != null ? fvb.getFactor() : null,
        fvb.getMissing() != null ? fvb.getMissing() : 0.0,
        modifier);
  }

  private Query buildConditionQueryV2(FieldValueBoost fvb) {
    if (fvb.getCondition() == null || fvb.getCondition().getRange() == null) {
      return OpenSearchQueryBuilder.matchAllQuery();
    }

    var range = fvb.getCondition().getRange();
    String field = fvb.getField();

    String gte = range.getGte() != null ? String.valueOf(range.getGte()) : null;
    String lte = range.getLte() != null ? String.valueOf(range.getLte()) : null;
    String gt = range.getGt() != null ? String.valueOf(range.getGt()) : null;
    String lt = range.getLt() != null ? String.valueOf(range.getLt()) : null;

    return OpenSearchQueryBuilder.rangeQuery(field, gte, lte, gt, lt);
  }

  private FieldValueFactorModifier toFieldValueFactorModifierV2(FieldValueBoost.Modifier modifier) {
    if (modifier == null) {
      return null;
    }

    return switch (modifier.value()) {
      case "log" -> FieldValueFactorModifier.Log;
      case "log1p" -> FieldValueFactorModifier.Log1p;
      case "sqrt" -> FieldValueFactorModifier.Sqrt;
      case "square" -> FieldValueFactorModifier.Square;
      case "ln" -> FieldValueFactorModifier.Ln;
      case "ln1p" -> FieldValueFactorModifier.Ln1p;
      case "ln2p" -> FieldValueFactorModifier.Ln2p;
      case "reciprocal" -> FieldValueFactorModifier.Reciprocal;
      default -> null;
    };
  }

  private FunctionScoreMode toScoreModeV2(String mode) {
    return switch (mode.toLowerCase()) {
      case "avg" -> FunctionScoreMode.Avg;
      case "max" -> FunctionScoreMode.Max;
      case "min" -> FunctionScoreMode.Min;
      case "multiply" -> FunctionScoreMode.Multiply;
      case "first" -> FunctionScoreMode.First;
      default -> FunctionScoreMode.Sum;
    };
  }

  private FunctionBoostMode toBoostModeV2(String mode) {
    return switch (mode.toLowerCase()) {
      case "sum" -> FunctionBoostMode.Sum;
      case "avg" -> FunctionBoostMode.Avg;
      case "max" -> FunctionBoostMode.Max;
      case "min" -> FunctionBoostMode.Min;
      case "replace" -> FunctionBoostMode.Replace;
      default -> FunctionBoostMode.Multiply;
    };
  }

  private Highlight buildHighlightingIfNeededV2(String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty()) {
      return null;
    }

    if (assetConfig.getHighlightFields() != null && !assetConfig.getHighlightFields().isEmpty()) {
      return buildHighlightsV2(assetConfig.getHighlightFields());
    } else if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      return buildHighlightsV2(searchSettings.getGlobalSettings().getHighlightFields());
    }

    return null;
  }

  private OpenSearchRequestBuilder createSearchSourceBuilderV2(Query query, int from, int size) {
    int maxHits = searchSettings.getGlobalSettings().getMaxResultHits();
    OpenSearchRequestBuilder builder = new OpenSearchRequestBuilder();
    builder.query(query);
    builder.from(Math.min(from, maxHits));
    builder.size(Math.min(size, maxHits));
    return builder;
  }

  protected void addConfiguredAggregationsV2(
      OpenSearchRequestBuilder searchRequestBuilder, AssetTypeConfiguration assetConfig) {
    Map<String, Aggregation> aggregations = new HashMap<>();

    aggregations.putAll(
        listOrEmpty(assetConfig.getAggregations()).stream()
            .collect(Collectors.toMap(Aggregation::getName, agg -> agg)));
    aggregations.putAll(
        listOrEmpty(searchSettings.getGlobalSettings().getAggregations()).stream()
            .collect(Collectors.toMap(Aggregation::getName, agg -> agg)));

    for (var entry : aggregations.entrySet()) {
      Aggregation agg = entry.getValue();
      os.org.opensearch.client.opensearch._types.aggregations.Aggregation termsAgg;
      int maxSize = searchSettings.getGlobalSettings().getMaxAggregateSize();

      if (!nullOrEmpty(agg.getField())) {
        String field = SearchSourceBuilderFactory.resolveFieldForSortOrAggregation(agg.getField());
        termsAgg = OpenSearchAggregationBuilder.termsAggregation(field, maxSize);
      } else if (!nullOrEmpty(agg.getScript())) {
        termsAgg =
            OpenSearchAggregationBuilder.termsAggregationWithScript(agg.getScript(), maxSize);
      } else {
        continue;
      }

      searchRequestBuilder.aggregation(agg.getName(), termsAgg);
    }
  }

  private OpenSearchRequestBuilder addAggregationV2(OpenSearchRequestBuilder searchRequestBuilder) {
    listOrEmpty(searchSettings.getGlobalSettings().getAggregations())
        .forEach(
            agg -> {
              os.org.opensearch.client.opensearch._types.aggregations.Aggregation termsAgg;
              int maxSize = searchSettings.getGlobalSettings().getMaxAggregateSize();

              if (!nullOrEmpty(agg.getField())) {
                String field =
                    SearchSourceBuilderFactory.resolveFieldForSortOrAggregation(agg.getField());
                termsAgg = OpenSearchAggregationBuilder.termsAggregation(field, maxSize);
              } else if (!nullOrEmpty(agg.getScript())) {
                termsAgg =
                    OpenSearchAggregationBuilder.termsAggregationWithScript(
                        agg.getScript(), maxSize);
              } else {
                return;
              }

              searchRequestBuilder.aggregation(agg.getName(), termsAgg);
            });
    return searchRequestBuilder;
  }

  public Highlight buildHighlightsV2(List<String> fields) {
    OpenSearchHighlightBuilder hb = new OpenSearchHighlightBuilder();
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    for (String field : listOrEmpty(fields)) {
      if (!isFlattenedExtensionField(field)) {
        hb.field(field, org.openmetadata.service.search.EntityBuilderConstant.MAX_ANALYZED_OFFSET);
      }
    }
    return hb.build();
  }

  // The flat_object `extension` field (and its `extension.*` subfields) has no analyzer on
  // OpenSearch; a mapped no-analyzer field fails the highlight shard, unlike an unmapped field
  // which
  // the highlighter silently skips. Drop it so a configured extension highlight field never 500s.
  private static boolean isFlattenedExtensionField(String field) {
    return field != null
        && (field.equals(FLATTENED_EXTENSION_FIELD)
            || field.startsWith(FLATTENED_EXTENSION_FIELD + "."));
  }

  public OpenSearchRequestBuilder getSearchSourceBuilderV2(
      String indexName, String searchQuery, int fromOffset, int size) {
    return getSearchSourceBuilderV2(indexName, searchQuery, fromOffset, size, false);
  }

  public OpenSearchRequestBuilder buildDataAssetSearchBuilderV2(
      String indexName, String query, int from, int size) {
    return buildDataAssetSearchBuilderV2(indexName, query, from, size, false);
  }

  public OpenSearchRequestBuilder buildTimeSeriesSearchBuilderV2(
      String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_result_search_index" -> buildTestCaseResultSearchV2(query, from, size);
      case "test_case_resolution_status_search_index" -> buildTestCaseResolutionStatusSearchV2(
          query, from, size);
      case "raw_cost_analysis_report_data_index",
          "aggregated_cost_analysis_report_data_index" -> buildCostAnalysisReportDataSearchV2(
          query, from, size);
      default -> buildAggregateSearchBuilderV2(query, from, size);
    };
  }

  public OpenSearchRequestBuilder buildDataQualitySearchBuilderV2(
      String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearchV2(query, from, size);
      default -> buildAggregateSearchBuilderV2(query, from, size);
    };
  }

  public OpenSearchRequestBuilder buildCommonSearchBuilderV2(String query, int from, int size) {
    AssetTypeConfiguration defaultConfig = getOrCreateDefaultConfig();
    LOG.debug(
        "buildCommonSearchBuilder called with query: '{}', using config: {}",
        query,
        defaultConfig.getAssetType());

    Query baseQuery = buildQueryWithMatchTypesV2(query, defaultConfig);
    Query finalQuery = applyGlobalBoostsV2(baseQuery);

    OpenSearchRequestBuilder searchRequestBuilder =
        createCommonSearchSourceBuilderV2(finalQuery, from, size);
    addHighlightsIfConfiguredV2(searchRequestBuilder);
    addAggregationV2(searchRequestBuilder);

    return searchRequestBuilder;
  }

  public OpenSearchRequestBuilder buildEntitySpecificAggregateSearchBuilderV2(
      String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);
    Query baseQuery = buildQueryWithMatchTypesV2(query, compositeConfig);

    List<FunctionScore> functions = collectAllBoostFunctionsV2();
    Query finalQuery = applyBoostFunctionsV2(baseQuery, functions);

    OpenSearchRequestBuilder searchRequestBuilder = searchBuilderV2(finalQuery, null, from, size);
    return addAggregationV2(searchRequestBuilder);
  }

  private Query applyGlobalBoostsV2(Query baseQuery) {
    List<FunctionScore> functions = collectGlobalBoostFunctionsV2();

    if (functions.isEmpty()) {
      return baseQuery;
    }

    return OpenSearchQueryBuilder.functionScoreQuery(
        baseQuery, functions, FunctionScoreMode.Sum, FunctionBoostMode.Sum, FUNCTION_BOOST_FACTOR);
  }

  private List<FunctionScore> collectGlobalBoostFunctionsV2() {
    List<FunctionScore> functions = new ArrayList<>();

    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      searchSettings.getGlobalSettings().getTermBoosts().stream()
          .map(this::buildTermBoostFunctionV2)
          .forEach(functions::add);
    }

    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      searchSettings.getGlobalSettings().getFieldValueBoosts().stream()
          .map(this::buildFieldValueBoostFunctionV2)
          .forEach(functions::add);
    }

    return functions;
  }

  private OpenSearchRequestBuilder createCommonSearchSourceBuilderV2(
      Query query, int from, int size) {
    return createSearchSourceBuilderV2(query, from, size);
  }

  private void addHighlightsIfConfiguredV2(OpenSearchRequestBuilder searchRequestBuilder) {
    if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      searchRequestBuilder.highlighter(
          buildHighlightsV2(searchSettings.getGlobalSettings().getHighlightFields()));
    }
  }

  private List<FunctionScore> collectAllBoostFunctionsV2() {

    // Add global boosts
    List<FunctionScore> functions = new ArrayList<>(collectGlobalBoostFunctionsV2());

    // Add entity-specific boosts
    addEntitySpecificBoostsV2(functions);

    return functions;
  }

  private void addEntitySpecificBoostsV2(List<FunctionScore> functions) {
    List<String> dataAssetTypes =
        List.of(
            "table",
            "dashboard",
            "topic",
            "pipeline",
            "mlmodel",
            "container",
            "searchIndex",
            "dashboardDataModel",
            "storedProcedure",
            "dataProduct");

    for (String assetType : dataAssetTypes) {
      AssetTypeConfiguration assetConfig = findAssetTypeConfig(assetType);
      if (assetConfig != null) {
        addAssetTypeBoostsV2(functions, assetType, assetConfig);
      }
    }
  }

  private AssetTypeConfiguration findAssetTypeConfig(String assetType) {
    return searchSettings.getAssetTypeConfigurations().stream()
        .filter(config -> config.getAssetType().equals(assetType))
        .findFirst()
        .orElse(null);
  }

  private void addAssetTypeBoostsV2(
      List<FunctionScore> functions, String assetType, AssetTypeConfiguration assetConfig) {

    if (assetConfig.getTermBoosts() != null) {
      assetConfig.getTermBoosts().stream()
          .map(tb -> buildEntitySpecificTermBoostV2(assetType, tb))
          .forEach(functions::add);
    }

    if (assetConfig.getFieldValueBoosts() != null) {
      assetConfig.getFieldValueBoosts().stream()
          .map(fvb -> buildEntitySpecificFieldValueBoostV2(assetType, fvb))
          .forEach(functions::add);
    }
  }

  private FunctionScore buildEntitySpecificTermBoostV2(String assetType, TermBoost tb) {
    Query filter =
        OpenSearchQueryBuilder.boolQuery()
            .must(OpenSearchQueryBuilder.termQuery("entityType", assetType))
            .must(OpenSearchQueryBuilder.termQuery(tb.getField(), tb.getValue()))
            .build();

    return OpenSearchQueryBuilder.weightFunction(filter, tb.getBoost());
  }

  private FunctionScore buildEntitySpecificFieldValueBoostV2(
      String assetType, FieldValueBoost fvb) {
    OpenSearchQueryBuilder.BoolQueryBuilder conditionBuilder =
        OpenSearchQueryBuilder.boolQuery()
            .must(OpenSearchQueryBuilder.termQuery("entityType", assetType));

    if (fvb.getCondition() != null && fvb.getCondition().getRange() != null) {
      Query rangeQuery = buildRangeQueryV2(fvb);
      conditionBuilder.must(rangeQuery);
    }

    Query condition = conditionBuilder.build();

    FieldValueFactorModifier modifier = toFieldValueFactorModifierV2(fvb.getModifier());

    return OpenSearchQueryBuilder.fieldValueFactorFunction(
        condition, fvb.getField(), fvb.getFactor(), fvb.getMissing(), modifier);
  }

  private Query buildRangeQueryV2(FieldValueBoost fvb) {
    var range = fvb.getCondition().getRange();
    String field = fvb.getField();

    String gte = range.getGte() != null ? String.valueOf(range.getGte()) : null;
    String lte = range.getLte() != null ? String.valueOf(range.getLte()) : null;
    String gt = range.getGt() != null ? String.valueOf(range.getGt()) : null;
    String lt = range.getLt() != null ? String.valueOf(range.getLt()) : null;

    return OpenSearchQueryBuilder.rangeQuery(field, gte, lte, gt, lt);
  }

  private Query applyBoostFunctionsV2(Query baseQuery, List<FunctionScore> functions) {
    if (functions.isEmpty()) {
      return baseQuery;
    }

    return OpenSearchQueryBuilder.functionScoreQuery(
        baseQuery, functions, FunctionScoreMode.Sum, FunctionBoostMode.Sum, FUNCTION_BOOST_FACTOR);
  }

  private Query buildComplexSyntaxQueryV2(String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> fuzzyFields = new HashMap<>();
    Map<String, Float> nonFuzzyFields = new HashMap<>();

    classifyFields(assetConfig, fuzzyFields, nonFuzzyFields);

    Query fuzzyQuery =
        OpenSearchQueryBuilder.queryStringQuery(
            query,
            fuzzyFields,
            Operator.And,
            "1",
            10,
            3,
            DEFAULT_TIE_BREAKER,
            TextQueryType.MostFields);

    Query nonFuzzyQuery =
        OpenSearchQueryBuilder.multiMatchQuery(
            query,
            nonFuzzyFields,
            TextQueryType.MostFields,
            Operator.And,
            String.valueOf(DEFAULT_TIE_BREAKER),
            "0");

    return OpenSearchQueryBuilder.boolQuery()
        .should(fuzzyQuery)
        .should(nonFuzzyQuery)
        .minimumShouldMatch(1)
        .must(OpenSearchQueryBuilder.matchAllQuery())
        .build();
  }

  private Query buildSimpleQueryV2(String query, AssetTypeConfiguration assetConfig) {
    RankingConfiguration ranking = SearchRankingHelper.resolveRanking(searchSettings, assetConfig);
    if (ranking != null) {
      return buildRankedSimpleQueryV2(query, assetConfig, ranking);
    }

    OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery = OpenSearchQueryBuilder.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByMatchType = groupFieldsByMatchType(assetConfig);

    addExactMatchQueriesV2(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_EXACT), multipliers.exactMatch);
    addPhraseMatchQueriesV2(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_PHRASE), multipliers.phraseMatch);
    addFuzzyMatchQueriesV2(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_FUZZY), multipliers.fuzzyMatch);
    addStandardMatchQueriesV2(combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_STANDARD));
    addCustomPropertyMatchQueriesV2(combinedQuery, query, assetConfig);

    combinedQuery.minimumShouldMatch(1);
    return OpenSearchQueryBuilder.boolQuery().must(combinedQuery.build()).build();
  }

  private Query buildRankedSimpleQueryV2(
      String query, AssetTypeConfiguration assetConfig, RankingConfiguration ranking) {
    List<Query> stageQueries = new ArrayList<>();
    String significantQuery = SearchRankingHelper.significantQueryText(query, ranking);

    for (RankingStage stage : listOrEmpty(ranking.getStages())) {
      Query stageQuery = buildRankingStageQueryV2(query, significantQuery, stage);
      if (stageQuery != null) {
        stageQueries.add(stageQuery);
      }
    }

    if (stageQueries.isEmpty()) {
      return buildLegacySimpleQueryV2(query, assetConfig);
    }

    OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery = OpenSearchQueryBuilder.boolQuery();
    combinedQuery.should(
        stageQueries.size() == 1
            ? stageQueries.getFirst()
            : OpenSearchQueryBuilder.disMaxQuery(
                stageQueries, SearchRankingHelper.disMaxTieBreaker(ranking)));
    addCustomPropertyMatchQueriesV2(combinedQuery, query, assetConfig);
    combinedQuery.minimumShouldMatch(1);
    return OpenSearchQueryBuilder.boolQuery().must(combinedQuery.build()).build();
  }

  private Query buildLegacySimpleQueryV2(String query, AssetTypeConfiguration assetConfig) {
    OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery = OpenSearchQueryBuilder.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByMatchType = groupFieldsByMatchType(assetConfig);

    addExactMatchQueriesV2(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_EXACT), multipliers.exactMatch);
    addPhraseMatchQueriesV2(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_PHRASE), multipliers.phraseMatch);
    addFuzzyMatchQueriesV2(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_FUZZY), multipliers.fuzzyMatch);
    addStandardMatchQueriesV2(combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_STANDARD));
    addCustomPropertyMatchQueriesV2(combinedQuery, query, assetConfig);

    combinedQuery.minimumShouldMatch(1);
    return OpenSearchQueryBuilder.boolQuery().must(combinedQuery.build()).build();
  }

  private Query buildRankingStageQueryV2(
      String originalQuery, String significantQuery, RankingStage stage) {
    if (stage.getFields() == null || stage.getFields().isEmpty()) {
      return null;
    }

    RankingStage.MatchType matchType =
        stage.getMatchType() == null ? RankingStage.MatchType.STANDARD : stage.getMatchType();
    return switch (matchType) {
      case EXACT -> buildExactRankingStageQueryV2(originalQuery, stage);
      case PHRASE -> buildPhraseRankingStageQueryV2(originalQuery, stage);
      case FUZZY -> buildTextRankingStageQueryV2(
          significantQuery, stage, getFuzziness(significantQuery));
      case TOKEN_COVERAGE, STANDARD -> buildTextRankingStageQueryV2(significantQuery, stage, "0");
    };
  }

  private Query buildExactRankingStageQueryV2(String query, RankingStage stage) {
    OpenSearchQueryBuilder.BoolQueryBuilder exactQuery = OpenSearchQueryBuilder.boolQuery();
    float weight = SearchRankingHelper.stageWeight(stage);
    for (String field : stage.getFields()) {
      exactQuery.should(
          OpenSearchQueryBuilder.termQuery(
              field, query.toLowerCase(Locale.ROOT), weight, rankingQueryName(stage, field)));
    }
    exactQuery.minimumShouldMatch(1);
    return exactQuery.build();
  }

  private Query buildPhraseRankingStageQueryV2(String query, RankingStage stage) {
    OpenSearchQueryBuilder.BoolQueryBuilder phraseQuery = OpenSearchQueryBuilder.boolQuery();
    float weight = SearchRankingHelper.stageWeight(stage);
    for (String field : stage.getFields()) {
      phraseQuery.should(
          OpenSearchQueryBuilder.matchPhraseQuery(
              field, query, weight, rankingQueryName(stage, field)));
    }
    phraseQuery.minimumShouldMatch(1);
    return phraseQuery.build();
  }

  private Query buildTextRankingStageQueryV2(String query, RankingStage stage, String fuzziness) {
    Map<String, Float> fields = new LinkedHashMap<>();
    stage.getFields().forEach(field -> fields.put(field, DEFAULT_BOOST));
    return OpenSearchQueryBuilder.multiMatchQuery(
        query,
        fields,
        TextQueryType.BestFields,
        Operator.Or,
        String.valueOf(DEFAULT_TIE_BREAKER),
        fuzziness,
        SearchRankingHelper.minimumShouldMatch(stage),
        SearchRankingHelper.stageWeight(stage),
        rankingQueryName(stage, "text"));
  }

  private String rankingQueryName(RankingStage stage, String field) {
    return RANKING_QUERY_PREFIX + stage.getName() + ":" + field;
  }

  /**
   * Adds a nested {@code customPropertiesTyped} clause for each admin-configured {@code
   * extension.<name>} search field. The raw {@code extension} field is {@code enabled:false} so an
   * oversized value can never reject the document, so the searchable value lives in the typed nested
   * field — see {@link CustomPropertySearchFields}.
   */
  private void addCustomPropertyMatchQueriesV2(
      OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      AssetTypeConfiguration assetConfig) {
    for (CustomPropertySearchFields.Spec spec : CustomPropertySearchFields.from(assetConfig)) {
      combinedQuery.should(customPropertyNestedQueryV2(query, spec));
    }
  }

  private Query customPropertyNestedQueryV2(String query, CustomPropertySearchFields.Spec spec) {
    Query inner =
        OpenSearchQueryBuilder.boolQuery()
            .must(customPropertyTermV2(CustomPropertySearchFields.NAME_FIELD, spec.propertyName()))
            .must(customPropertyValueQueryV2(query, spec))
            .build();
    return OpenSearchQueryBuilder.nestedQuery(
        CustomPropertySearchFields.CUSTOM_PROPERTIES_TYPED, inner);
  }

  private Query customPropertyValueQueryV2(String query, CustomPropertySearchFields.Spec spec) {
    Query result;
    if (spec.exact()) {
      result =
          Query.of(
              q ->
                  q.term(
                      t ->
                          t.field(CustomPropertySearchFields.STRING_VALUE_FIELD)
                              .value(FieldValue.of(query))
                              .boost(spec.boost())));
    } else {
      result =
          Query.of(
              q ->
                  q.match(
                      m ->
                          m.field(CustomPropertySearchFields.TEXT_VALUE_FIELD)
                              .query(FieldValue.of(query))
                              .boost(spec.boost())));
    }
    return result;
  }

  private static Query customPropertyTermV2(String field, String value) {
    return Query.of(q -> q.term(t -> t.field(field).value(FieldValue.of(value))));
  }

  private void addExactMatchQueriesV2(
      OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Float> fields,
      float multiplier) {
    if (!fields.isEmpty()) {
      OpenSearchQueryBuilder.BoolQueryBuilder exactMatchQuery = OpenSearchQueryBuilder.boolQuery();
      fields.forEach(
          (field, boost) ->
              exactMatchQuery.should(
                  Query.of(
                      q ->
                          q.term(
                              t ->
                                  t.field(field)
                                      .value(FieldValue.of(query.toLowerCase()))
                                      .boost(boost * multiplier)))));
      if (!exactMatchQuery.build()._kind().name().equals("match_none")) {
        combinedQuery.should(exactMatchQuery.build());
      }
    }
  }

  private void addPhraseMatchQueriesV2(
      OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Float> fields,
      float multiplier) {
    if (!fields.isEmpty()) {
      OpenSearchQueryBuilder.BoolQueryBuilder phraseMatchQuery = OpenSearchQueryBuilder.boolQuery();
      fields.forEach(
          (field, boost) ->
              phraseMatchQuery.should(
                  Query.of(
                      q ->
                          q.matchPhrase(
                              m -> m.field(field).query(query).boost(boost * multiplier)))));
      if (!phraseMatchQuery.build()._kind().name().equals("match_none")) {
        combinedQuery.should(phraseMatchQuery.build());
      }
    }
  }

  private void addFuzzyMatchQueriesV2(
      OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Float> fields,
      float multiplier) {
    if (!fields.isEmpty()) {
      List<String> fieldList = new ArrayList<>();
      fields.forEach(
          (field, boost) -> {
            if (boost != null && boost != 1.0f) {
              fieldList.add(field + "^" + boost);
            } else {
              fieldList.add(field);
            }
          });

      String fuzziness = getFuzziness(query);
      int maxExpansions = getMaxExpansions(query);

      Query fuzzyQuery =
          Query.of(
              q ->
                  q.multiMatch(
                      m ->
                          m.query(query)
                              .fields(fieldList)
                              .type(TextQueryType.MostFields)
                              .operator(Operator.Or)
                              .fuzziness(fuzziness)
                              .maxExpansions(maxExpansions)
                              .prefixLength(1)
                              .minimumShouldMatch(MINIMUM_SHOULD_MATCH)
                              .tieBreaker(DEFAULT_TIE_BREAKER)
                              .boost(multiplier)));
      combinedQuery.should(fuzzyQuery);
    }
  }

  private void addStandardMatchQueriesV2(
      OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Float> standardFields) {
    if (!standardFields.isEmpty()) {
      Map<String, Float> fuzzyFields =
          standardFields.entrySet().stream()
              .filter(entry -> isFuzzyField(entry.getKey()))
              .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

      Map<String, Float> nonFuzzyFields =
          standardFields.entrySet().stream()
              .filter(entry -> isNonFuzzyField(entry.getKey()))
              .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

      if (!fuzzyFields.isEmpty()) {
        Query fuzzyQueryBuilder = createStandardFuzzyQueryV2(query, fuzzyFields);
        combinedQuery.should(fuzzyQueryBuilder);
      }

      if (!nonFuzzyFields.isEmpty()) {
        Query nonFuzzyQueryBuilder = createStandardNonFuzzyQueryV2(query, nonFuzzyFields);
        combinedQuery.should(nonFuzzyQueryBuilder);
      }
    }
  }

  private Query createStandardFuzzyQueryV2(String query, Map<String, Float> fields) {
    return OpenSearchQueryBuilder.multiMatchQuery(
        query,
        fields,
        TextQueryType.MostFields,
        Operator.Or,
        String.valueOf(DEFAULT_TIE_BREAKER),
        getFuzziness(query));
  }

  private Query createStandardNonFuzzyQueryV2(String query, Map<String, Float> fields) {
    return OpenSearchQueryBuilder.multiMatchQuery(
        query,
        fields,
        TextQueryType.MostFields,
        Operator.And,
        String.valueOf(DEFAULT_TIE_BREAKER),
        "0");
  }
}
