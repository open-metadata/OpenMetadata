package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static org.openmetadata.service.search.SearchUtil.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtil.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtil.isServiceIndex;
import static org.openmetadata.service.search.SearchUtil.isTimeSeriesIndex;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchSourceBuilderFactory;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;
import org.openmetadata.service.search.indexes.TestCaseResultIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
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
  private static final String MINIMUM_SHOULD_MATCH = "2<70%";
  private static final float DEFAULT_TIE_BREAKER = 0.3f;
  private static final float DEFAULT_BOOST = 1.0f;
  private static final float FUNCTION_BOOST_FACTOR = 0.3f;

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
    compositeConfig.setBoostMode(AssetTypeConfiguration.BoostMode.SUM);

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

  public os.org.opensearch.client.opensearch._types.query_dsl.Query buildSearchQueryBuilderV2(
      String query, Map<String, Float> fields) {
    Map<String, Float> fuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    Map<String, Float> nonFuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isNonFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    os.org.opensearch.client.opensearch._types.query_dsl.Query fuzzyQuery =
        OpenSearchQueryBuilder.queryStringQuery(
            query,
            fuzzyFields,
            os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
            "1",
            10,
            3,
            DEFAULT_TIE_BREAKER,
            os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields);

    os.org.opensearch.client.opensearch._types.query_dsl.Query nonFuzzyQuery =
        OpenSearchQueryBuilder.multiMatchQuery(
            query,
            nonFuzzyFields,
            os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields,
            os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
            String.valueOf(DEFAULT_TIE_BREAKER),
            "0");

    return OpenSearchQueryBuilder.boolQuery()
        .should(fuzzyQuery)
        .should(nonFuzzyQuery)
        .minimumShouldMatch(1)
        .build();
  }

  public OpenSearchRequestBuilder searchBuilderV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query query,
      os.org.opensearch.client.opensearch.core.search.Highlight highlightBuilder,
      int fromOffset,
      int size) {
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
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, UserIndex.getFields());
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
      default -> buildAggregateSearchBuilderV2(searchQuery, fromOffset, size, includeAggregations);
    };
  }

  public OpenSearchRequestBuilder buildTestCaseSearchV2(String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseIndex.getFields());
    os.org.opensearch.client.opensearch.core.search.Highlight highlighter =
        buildHighlightsV2(List.of("testSuite.name", "testSuite.description"));
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildCostAnalysisReportDataSearchV2(
      String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        OpenSearchQueryBuilder.queryStringQuery(query);
    return searchBuilderV2(queryBuilder, null, from, size);
  }

  public OpenSearchRequestBuilder buildTestCaseResolutionStatusSearchV2(
      String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseResolutionStatusIndex.getFields());
    os.org.opensearch.client.opensearch.core.search.Highlight highlighter =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildTestCaseResultSearchV2(String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseResultIndex.getFields());
    os.org.opensearch.client.opensearch.core.search.Highlight highlighter =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildServiceSearchBuilderV2(String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, SearchIndex.getDefaultFields());
    os.org.opensearch.client.opensearch.core.search.Highlight highlighter =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildAggregateSearchBuilderV2(String query, int from, int size) {
    return buildAggregateSearchBuilderV2(query, from, size, true);
  }

  @Override
  public OpenSearchRequestBuilder buildAggregateSearchBuilderV2(
      String query, int from, int size, boolean includeAggregations) {
    AssetTypeConfiguration compositeConfig = getOrBuildCompositeConfig();
    os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, compositeConfig);
    os.org.opensearch.client.opensearch._types.query_dsl.Query finalQuery =
        applyFunctionScoringV2(baseQuery, compositeConfig);

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
    os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery =
        buildBaseQueryV2(query, assetConfig);
    os.org.opensearch.client.opensearch._types.query_dsl.Query finalQuery =
        applyFunctionScoringV2(baseQuery, assetConfig);
    os.org.opensearch.client.opensearch.core.search.Highlight highlightBuilder =
        buildHighlightingIfNeededV2(query, assetConfig);

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

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildBaseQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
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

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildQueryWithMatchTypesV2(
      String query, AssetTypeConfiguration assetConfig) {
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

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildComplexQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> allFields = extractAllFields(assetConfig);

    os.org.opensearch.client.opensearch._types.query_dsl.Query queryStringBuilder =
        OpenSearchQueryBuilder.queryStringQuery(
            query,
            allFields,
            os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
            null,
            50,
            0,
            0.5,
            os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields);

    return OpenSearchQueryBuilder.boolQuery().must(queryStringBuilder).build();
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildSimpleQueryWithTypesV2(
      String query, AssetTypeConfiguration assetConfig) {
    OpenSearchQueryBuilder.BoolQueryBuilder combinedQuery = OpenSearchQueryBuilder.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByType = groupFieldsByMatchType(assetConfig);

    addMatchTypeQueriesV2(combinedQuery, query, fieldsByType, multipliers);

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

  private os.org.opensearch.client.opensearch._types.query_dsl.Query applyFunctionScoringV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery,
      AssetTypeConfiguration assetConfig) {
    List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions =
        collectBoostFunctionsV2(assetConfig);

    if (functions.isEmpty()) {
      return baseQuery;
    }

    os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode scoreMode;
    if (assetConfig.getScoreMode() != null) {
      scoreMode = toScoreModeV2(assetConfig.getScoreMode().value());
    } else {
      scoreMode = os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Sum;
    }

    os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode boostMode;
    if (assetConfig.getBoostMode() != null) {
      boostMode = toBoostModeV2(assetConfig.getBoostMode().value());
    } else {
      boostMode = os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Sum;
    }

    return OpenSearchQueryBuilder.functionScoreQuery(
        baseQuery, functions, scoreMode, boostMode, FUNCTION_BOOST_FACTOR);
  }

  private List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore>
      collectBoostFunctionsV2(AssetTypeConfiguration assetConfig) {
    List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions =
        new ArrayList<>();

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

  private os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore
      buildTermBoostFunctionV2(TermBoost tb) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query filter =
        OpenSearchQueryBuilder.termQuery(tb.getField(), tb.getValue());
    return OpenSearchQueryBuilder.weightFunction(filter, tb.getBoost());
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore
      buildFieldValueBoostFunctionV2(FieldValueBoost fvb) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query condition =
        buildConditionQueryV2(fvb);

    os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier modifier =
        toFieldValueFactorModifierV2(fvb.getModifier());

    return OpenSearchQueryBuilder.fieldValueFactorFunction(
        condition,
        fvb.getField(),
        fvb.getFactor() != null ? fvb.getFactor() : null,
        fvb.getMissing() != null ? fvb.getMissing() : 0.0,
        modifier);
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildConditionQueryV2(
      FieldValueBoost fvb) {
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

  private os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
      toFieldValueFactorModifierV2(FieldValueBoost.Modifier modifier) {
    if (modifier == null) {
      return null;
    }

    return switch (modifier.value()) {
      case "log" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
          .Log;
      case "log1p" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
          .Log1p;
      case "sqrt" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
          .Sqrt;
      case "square" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
          .Square;
      case "ln" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier.Ln;
      case "ln1p" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
          .Ln1p;
      case "ln2p" -> os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
          .Ln2p;
      case "reciprocal" -> os.org.opensearch.client.opensearch._types.query_dsl
          .FieldValueFactorModifier.Reciprocal;
      default -> null;
    };
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode toScoreModeV2(
      String mode) {
    return switch (mode.toLowerCase()) {
      case "avg" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Avg;
      case "max" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Max;
      case "min" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Min;
      case "multiply" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
          .Multiply;
      case "first" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.First;
      default -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Sum;
    };
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode toBoostModeV2(
      String mode) {
    return switch (mode.toLowerCase()) {
      case "sum" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Sum;
      case "avg" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Avg;
      case "max" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Max;
      case "min" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Min;
      case "replace" -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
          .Replace;
      default -> os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Multiply;
    };
  }

  private os.org.opensearch.client.opensearch.core.search.Highlight buildHighlightingIfNeededV2(
      String query, AssetTypeConfiguration assetConfig) {
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

  private OpenSearchRequestBuilder createSearchSourceBuilderV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query query, int from, int size) {
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
        termsAgg = OpenSearchAggregationBuilder.termsAggregation(agg.getField(), maxSize);
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
    searchSettings
        .getGlobalSettings()
        .getAggregations()
        .forEach(
            agg -> {
              os.org.opensearch.client.opensearch._types.aggregations.Aggregation termsAgg;
              int maxSize = searchSettings.getGlobalSettings().getMaxAggregateSize();

              if (!nullOrEmpty(agg.getField())) {
                termsAgg = OpenSearchAggregationBuilder.termsAggregation(agg.getField(), maxSize);
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

  public os.org.opensearch.client.opensearch.core.search.Highlight buildHighlightsV2(
      List<String> fields) {
    OpenSearchHighlightBuilder hb = new OpenSearchHighlightBuilder();
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    for (String field : listOrEmpty(fields)) {
      hb.field(field, org.openmetadata.service.search.EntityBuilderConstant.MAX_ANALYZED_OFFSET);
    }
    return hb.build();
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

    os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, defaultConfig);
    os.org.opensearch.client.opensearch._types.query_dsl.Query finalQuery =
        applyGlobalBoostsV2(baseQuery);

    OpenSearchRequestBuilder searchRequestBuilder =
        createCommonSearchSourceBuilderV2(finalQuery, from, size);
    addHighlightsIfConfiguredV2(searchRequestBuilder);
    addAggregationV2(searchRequestBuilder);

    return searchRequestBuilder;
  }

  public OpenSearchRequestBuilder buildEntitySpecificAggregateSearchBuilderV2(
      String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);
    os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, compositeConfig);

    List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions =
        collectAllBoostFunctionsV2();
    os.org.opensearch.client.opensearch._types.query_dsl.Query finalQuery =
        applyBoostFunctionsV2(baseQuery, functions);

    OpenSearchRequestBuilder searchRequestBuilder = searchBuilderV2(finalQuery, null, from, size);
    return addAggregationV2(searchRequestBuilder);
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query applyGlobalBoostsV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery) {
    List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions =
        collectGlobalBoostFunctionsV2();

    if (functions.isEmpty()) {
      return baseQuery;
    }

    return OpenSearchQueryBuilder.functionScoreQuery(
        baseQuery,
        functions,
        os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Sum,
        os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Sum,
        FUNCTION_BOOST_FACTOR);
  }

  private List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore>
      collectGlobalBoostFunctionsV2() {
    List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions =
        new ArrayList<>();

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
      os.org.opensearch.client.opensearch._types.query_dsl.Query query, int from, int size) {
    return createSearchSourceBuilderV2(query, from, size);
  }

  private void addHighlightsIfConfiguredV2(OpenSearchRequestBuilder searchRequestBuilder) {
    if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      searchRequestBuilder.highlighter(
          buildHighlightsV2(searchSettings.getGlobalSettings().getHighlightFields()));
    }
  }

  private List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore>
      collectAllBoostFunctionsV2() {

    // Add global boosts
    List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions =
        new ArrayList<>(collectGlobalBoostFunctionsV2());

    // Add entity-specific boosts
    addEntitySpecificBoostsV2(functions);

    return functions;
  }

  private void addEntitySpecificBoostsV2(
      List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions) {
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
      List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions,
      String assetType,
      AssetTypeConfiguration assetConfig) {

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

  private os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore
      buildEntitySpecificTermBoostV2(String assetType, TermBoost tb) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query filter =
        OpenSearchQueryBuilder.boolQuery()
            .must(OpenSearchQueryBuilder.termQuery("entityType", assetType))
            .must(OpenSearchQueryBuilder.termQuery(tb.getField(), tb.getValue()))
            .build();

    return OpenSearchQueryBuilder.weightFunction(filter, tb.getBoost());
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore
      buildEntitySpecificFieldValueBoostV2(String assetType, FieldValueBoost fvb) {
    OpenSearchQueryBuilder.BoolQueryBuilder conditionBuilder =
        OpenSearchQueryBuilder.boolQuery()
            .must(OpenSearchQueryBuilder.termQuery("entityType", assetType));

    if (fvb.getCondition() != null && fvb.getCondition().getRange() != null) {
      os.org.opensearch.client.opensearch._types.query_dsl.Query rangeQuery =
          buildRangeQueryV2(fvb);
      conditionBuilder.must(rangeQuery);
    }

    os.org.opensearch.client.opensearch._types.query_dsl.Query condition = conditionBuilder.build();

    os.org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier modifier =
        toFieldValueFactorModifierV2(fvb.getModifier());

    return OpenSearchQueryBuilder.fieldValueFactorFunction(
        condition, fvb.getField(), fvb.getFactor(), fvb.getMissing(), modifier);
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildRangeQueryV2(
      FieldValueBoost fvb) {
    var range = fvb.getCondition().getRange();
    String field = fvb.getField();

    String gte = range.getGte() != null ? String.valueOf(range.getGte()) : null;
    String lte = range.getLte() != null ? String.valueOf(range.getLte()) : null;
    String gt = range.getGt() != null ? String.valueOf(range.getGt()) : null;
    String lt = range.getLt() != null ? String.valueOf(range.getLt()) : null;

    return OpenSearchQueryBuilder.rangeQuery(field, gte, lte, gt, lt);
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query applyBoostFunctionsV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery,
      List<os.org.opensearch.client.opensearch._types.query_dsl.FunctionScore> functions) {
    if (functions.isEmpty()) {
      return baseQuery;
    }

    return OpenSearchQueryBuilder.functionScoreQuery(
        baseQuery,
        functions,
        os.org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode.Sum,
        os.org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode.Sum,
        FUNCTION_BOOST_FACTOR);
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildComplexSyntaxQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> fuzzyFields = new HashMap<>();
    Map<String, Float> nonFuzzyFields = new HashMap<>();

    classifyFields(assetConfig, fuzzyFields, nonFuzzyFields);

    os.org.opensearch.client.opensearch._types.query_dsl.Query fuzzyQuery =
        OpenSearchQueryBuilder.queryStringQuery(
            query,
            fuzzyFields,
            os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
            "1",
            10,
            3,
            DEFAULT_TIE_BREAKER,
            os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields);

    os.org.opensearch.client.opensearch._types.query_dsl.Query nonFuzzyQuery =
        OpenSearchQueryBuilder.multiMatchQuery(
            query,
            nonFuzzyFields,
            os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields,
            os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
            String.valueOf(DEFAULT_TIE_BREAKER),
            "0");

    return OpenSearchQueryBuilder.boolQuery()
        .should(fuzzyQuery)
        .should(nonFuzzyQuery)
        .minimumShouldMatch(1)
        .must(OpenSearchQueryBuilder.matchAllQuery())
        .build();
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildSimpleQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
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

    combinedQuery.minimumShouldMatch(1);
    return OpenSearchQueryBuilder.boolQuery().must(combinedQuery.build()).build();
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
                  os.org.opensearch.client.opensearch._types.query_dsl.Query.of(
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
                  os.org.opensearch.client.opensearch._types.query_dsl.Query.of(
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

      os.org.opensearch.client.opensearch._types.query_dsl.Query fuzzyQuery =
          os.org.opensearch.client.opensearch._types.query_dsl.Query.of(
              q ->
                  q.multiMatch(
                      m ->
                          m.query(query)
                              .fields(fieldList)
                              .type(
                                  os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType
                                      .MostFields)
                              .operator(
                                  os.org.opensearch.client.opensearch._types.query_dsl.Operator.Or)
                              .fuzziness("1")
                              .maxExpansions(10)
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
        os.org.opensearch.client.opensearch._types.query_dsl.Query fuzzyQueryBuilder =
            createStandardFuzzyQueryV2(query, fuzzyFields);
        combinedQuery.should(fuzzyQueryBuilder);
      }

      if (!nonFuzzyFields.isEmpty()) {
        os.org.opensearch.client.opensearch._types.query_dsl.Query nonFuzzyQueryBuilder =
            createStandardNonFuzzyQueryV2(query, nonFuzzyFields);
        combinedQuery.should(nonFuzzyQueryBuilder);
      }
    }
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query createStandardFuzzyQueryV2(
      String query, Map<String, Float> fields) {
    return OpenSearchQueryBuilder.multiMatchQuery(
        query,
        fields,
        os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields,
        os.org.opensearch.client.opensearch._types.query_dsl.Operator.Or,
        String.valueOf(DEFAULT_TIE_BREAKER),
        "1");
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query createStandardNonFuzzyQueryV2(
      String query, Map<String, Float> fields) {
    return OpenSearchQueryBuilder.multiMatchQuery(
        query,
        fields,
        os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields,
        os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
        String.valueOf(DEFAULT_TIE_BREAKER),
        "0");
  }
}
