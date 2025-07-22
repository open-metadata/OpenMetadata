package org.openmetadata.service.search.elasticsearch;

import static es.org.elasticsearch.index.query.MultiMatchQueryBuilder.Type.MOST_FIELDS;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_ANALYZED_OFFSET;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;

import es.org.elasticsearch.common.lucene.search.function.CombineFunction;
import es.org.elasticsearch.common.lucene.search.function.FieldValueFactorFunction;
import es.org.elasticsearch.common.lucene.search.function.FunctionScoreQuery;
import es.org.elasticsearch.common.unit.Fuzziness;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.MultiMatchQueryBuilder;
import es.org.elasticsearch.index.query.Operator;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.index.query.QueryStringQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.FieldValueFactorFunctionBuilder;
import es.org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.ScoreFunctionBuilders;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchSourceBuilderFactory;
import org.openmetadata.service.search.indexes.*;

public class ElasticSearchSourceBuilderFactory
    implements SearchSourceBuilderFactory<
        SearchSourceBuilder, QueryBuilder, HighlightBuilder, FunctionScoreQueryBuilder> {

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

  public ElasticSearchSourceBuilderFactory(SearchSettings searchSettings) {
    this.searchSettings = searchSettings;
  }

  @Override
  public QueryBuilder buildSearchQueryBuilder(String query, Map<String, Float> fields) {
    Map<String, Float> fuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    Map<String, Float> nonFuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isNonFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    QueryStringQueryBuilder fuzzyQueryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(fuzzyFields)
            .type(MOST_FIELDS)
            .defaultOperator(Operator.AND)
            .fuzziness(Fuzziness.AUTO)
            .fuzzyMaxExpansions(10)
            .fuzzyPrefixLength(3)
            .tieBreaker(DEFAULT_TIE_BREAKER);

    MultiMatchQueryBuilder nonFuzzyQueryBuilder =
        QueryBuilders.multiMatchQuery(query)
            .fields(nonFuzzyFields)
            .type(MOST_FIELDS)
            .operator(Operator.AND)
            .tieBreaker(DEFAULT_TIE_BREAKER)
            .fuzziness(Fuzziness.ZERO);

    return QueryBuilders.boolQuery()
        .should(fuzzyQueryBuilder)
        .should(nonFuzzyQueryBuilder)
        .minimumShouldMatch(1);
  }

  @Override
  public SearchSourceBuilder searchBuilder(
      QueryBuilder query, HighlightBuilder highlightBuilder, int from, int size) {
    SearchSourceBuilder builder = new SearchSourceBuilder();
    builder.query(query);
    if (highlightBuilder != null) {
      builder.highlighter(highlightBuilder);
    }
    builder.from(from);
    builder.size(size);
    return builder;
  }

  @Override
  public SearchSourceBuilder buildUserOrTeamSearchBuilder(String query, int from, int size) {
    QueryBuilder queryBuilder = buildSearchQueryBuilder(query, UserIndex.getFields());
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder addAggregation(SearchSourceBuilder searchSourceBuilder) {
    searchSettings
        .getGlobalSettings()
        .getAggregations()
        .forEach(
            agg ->
                searchSourceBuilder.aggregation(
                    AggregationBuilders.terms(agg.getName())
                        .field(agg.getField())
                        .size(searchSettings.getGlobalSettings().getMaxAggregateSize())));
    return searchSourceBuilder;
  }

  @Override
  public SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryBuilder queryBuilder = buildSearchQueryBuilder(query, TestCaseIndex.getFields());
    HighlightBuilder hb = buildHighlights(List.of("testSuite.name", "testSuite.description"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  @Override
  public SearchSourceBuilder buildCostAnalysisReportDataSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query);
    return searchBuilder(queryBuilder, null, from, size);
  }

  @Override
  public SearchSourceBuilder buildTestCaseResolutionStatusSearch(String query, int from, int size) {
    QueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, TestCaseResolutionStatusIndex.getFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  @Override
  public SearchSourceBuilder buildTestCaseResultSearch(String query, int from, int size) {
    QueryBuilder queryBuilder = buildSearchQueryBuilder(query, TestCaseResultIndex.getFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  @Override
  public SearchSourceBuilder buildServiceSearchBuilder(String query, int from, int size) {
    QueryBuilder queryBuilder = buildSearchQueryBuilder(query, SearchIndex.getDefaultFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  @Override
  public SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, compositeConfig);
    QueryBuilder finalQuery = applyFunctionScoring(baseQuery, compositeConfig);

    SearchSourceBuilder searchSourceBuilder = searchBuilder(finalQuery, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  @Override
  public SearchSourceBuilder buildDataAssetSearchBuilder(
      String indexName, String query, int from, int size) {
    return buildDataAssetSearchBuilder(indexName, query, from, size, false);
  }

  @Override
  public SearchSourceBuilder buildDataAssetSearchBuilder(
      String indexName, String query, int from, int size, boolean explain) {
    AssetTypeConfiguration assetConfig = getAssetConfiguration(indexName);
    QueryBuilder baseQuery = buildBaseQuery(query, assetConfig);
    QueryBuilder finalQuery = applyFunctionScoring(baseQuery, assetConfig);
    HighlightBuilder highlightBuilder = buildHighlightingIfNeeded(query, assetConfig);

    SearchSourceBuilder searchSourceBuilder = createSearchSourceBuilder(finalQuery, from, size);
    if (highlightBuilder != null) {
      searchSourceBuilder.highlighter(highlightBuilder);
    }

    addConfiguredAggregations(searchSourceBuilder, assetConfig);
    searchSourceBuilder.explain(explain);

    return searchSourceBuilder;
  }

  private AssetTypeConfiguration getAssetConfiguration(String indexName) {
    String resolvedIndex = Entity.getSearchRepository().getIndexNameWithoutAlias(indexName);
    if (resolvedIndex.equals(INDEX_ALL) || resolvedIndex.equals(INDEX_DATA_ASSET)) {
      return buildCompositeAssetConfig(searchSettings);
    } else {
      return findAssetTypeConfig(indexName, searchSettings);
    }
  }

  private QueryBuilder buildBaseQuery(String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return QueryBuilders.boolQuery().must(QueryBuilders.matchAllQuery());
    } else if (containsQuerySyntax(query)) {
      return buildComplexSyntaxQuery(query, assetConfig);
    } else {
      return buildSimpleQuery(query, assetConfig);
    }
  }

  private QueryBuilder buildComplexSyntaxQuery(String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> fuzzyFields = new HashMap<>();
    Map<String, Float> nonFuzzyFields = new HashMap<>();

    classifyFields(assetConfig, fuzzyFields, nonFuzzyFields);

    QueryStringQueryBuilder fuzzyQueryBuilder = createFuzzyQueryBuilder(query, fuzzyFields);
    MultiMatchQueryBuilder nonFuzzyQueryBuilder = createNonFuzzyQueryBuilder(query, nonFuzzyFields);

    BoolQueryBuilder combinedQuery =
        QueryBuilders.boolQuery()
            .should(fuzzyQueryBuilder)
            .should(nonFuzzyQueryBuilder)
            .minimumShouldMatch(1);

    return QueryBuilders.boolQuery().must(combinedQuery);
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

  private QueryStringQueryBuilder createFuzzyQueryBuilder(String query, Map<String, Float> fields) {
    return QueryBuilders.queryStringQuery(query)
        .fields(fields)
        .defaultOperator(Operator.AND)
        .type(MOST_FIELDS)
        .fuzziness(Fuzziness.AUTO)
        .fuzzyMaxExpansions(10)
        .fuzzyPrefixLength(1)
        .tieBreaker(DEFAULT_TIE_BREAKER);
  }

  private MultiMatchQueryBuilder createNonFuzzyQueryBuilder(
      String query, Map<String, Float> fields) {
    return QueryBuilders.multiMatchQuery(query)
        .fields(fields)
        .type(MOST_FIELDS)
        .operator(Operator.AND)
        .tieBreaker(DEFAULT_TIE_BREAKER)
        .fuzziness(Fuzziness.ZERO);
  }

  private QueryBuilder buildSimpleQuery(String query, AssetTypeConfiguration assetConfig) {
    BoolQueryBuilder combinedQuery = QueryBuilders.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByMatchType = groupFieldsByMatchType(assetConfig);

    addExactMatchQueries(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_EXACT), multipliers.exactMatch);
    addPhraseMatchQueries(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_PHRASE), multipliers.phraseMatch);
    addFuzzyMatchQueries(
        combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_FUZZY), multipliers.fuzzyMatch);
    addStandardMatchQueries(combinedQuery, query, fieldsByMatchType.get(MATCH_TYPE_STANDARD));

    combinedQuery.minimumShouldMatch(1);
    return QueryBuilders.boolQuery().must(combinedQuery);
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
                    fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : 1.0f;
                fieldsByType.get(matchType).put(fieldBoost.getField(), boost);
              });
    }
    return fieldsByType;
  }

  private void addExactMatchQueries(
      BoolQueryBuilder combinedQuery, String query, Map<String, Float> fields, float multiplier) {
    if (!fields.isEmpty()) {
      BoolQueryBuilder exactMatchQuery = QueryBuilders.boolQuery();
      fields.forEach(
          (field, boost) ->
              exactMatchQuery.should(
                  QueryBuilders.termQuery(field, query.toLowerCase()).boost(boost)));
      if (exactMatchQuery.hasClauses()) {
        combinedQuery.should(exactMatchQuery.boost(multiplier));
      }
    }
  }

  private void addPhraseMatchQueries(
      BoolQueryBuilder combinedQuery, String query, Map<String, Float> fields, float multiplier) {
    if (!fields.isEmpty()) {
      BoolQueryBuilder phraseMatchQuery = QueryBuilders.boolQuery();
      fields.forEach(
          (field, boost) ->
              phraseMatchQuery.should(QueryBuilders.matchPhraseQuery(field, query).boost(boost)));
      if (phraseMatchQuery.hasClauses()) {
        combinedQuery.should(phraseMatchQuery.boost(multiplier));
      }
    }
  }

  private void addFuzzyMatchQueries(
      BoolQueryBuilder combinedQuery, String query, Map<String, Float> fields, float multiplier) {
    if (!fields.isEmpty()) {
      MultiMatchQueryBuilder fuzzyQueryBuilder =
          QueryBuilders.multiMatchQuery(query)
              .type(MOST_FIELDS)
              .fuzziness(Fuzziness.AUTO)
              .maxExpansions(10)
              .prefixLength(1)
              .operator(Operator.OR)
              .minimumShouldMatch(MINIMUM_SHOULD_MATCH)
              .tieBreaker(DEFAULT_TIE_BREAKER);
      fields.forEach(fuzzyQueryBuilder::field);
      combinedQuery.should(fuzzyQueryBuilder.boost(multiplier));
    }
  }

  private void addStandardMatchQueries(
      BoolQueryBuilder combinedQuery, String query, Map<String, Float> standardFields) {
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
        MultiMatchQueryBuilder fuzzyQueryBuilder = createStandardFuzzyQuery(query);
        fuzzyFields.forEach(fuzzyQueryBuilder::field);
        combinedQuery.should(fuzzyQueryBuilder);
      }

      if (!nonFuzzyFields.isEmpty()) {
        MultiMatchQueryBuilder nonFuzzyQueryBuilder = createStandardNonFuzzyQuery(query);
        nonFuzzyFields.forEach(nonFuzzyQueryBuilder::field);
        combinedQuery.should(nonFuzzyQueryBuilder);
      }
    }
  }

  private MultiMatchQueryBuilder createStandardFuzzyQuery(String query) {
    return QueryBuilders.multiMatchQuery(query)
        .type(MOST_FIELDS)
        .fuzziness(Fuzziness.AUTO)
        .maxExpansions(10)
        .prefixLength(1)
        .operator(Operator.OR)
        .minimumShouldMatch(MINIMUM_SHOULD_MATCH)
        .tieBreaker(DEFAULT_TIE_BREAKER);
  }

  private MultiMatchQueryBuilder createStandardNonFuzzyQuery(String query) {
    return QueryBuilders.multiMatchQuery(query)
        .type(MOST_FIELDS)
        .operator(Operator.OR)
        .minimumShouldMatch(MINIMUM_SHOULD_MATCH)
        .tieBreaker(DEFAULT_TIE_BREAKER)
        .fuzziness(Fuzziness.ZERO);
  }

  private QueryBuilder applyFunctionScoring(
      QueryBuilder baseQuery, AssetTypeConfiguration assetConfig) {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions =
        collectBoostFunctions(assetConfig);

    if (functions.isEmpty()) {
      return baseQuery;
    }

    FunctionScoreQueryBuilder functionScore =
        QueryBuilders.functionScoreQuery(
            baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));

    configureFunctionScore(functionScore, assetConfig);
    return functionScore;
  }

  private List<FunctionScoreQueryBuilder.FilterFunctionBuilder> collectBoostFunctions(
      AssetTypeConfiguration assetConfig) {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();

    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      searchSettings.getGlobalSettings().getTermBoosts().stream()
          .map(this::buildTermBoostFunction)
          .forEach(functions::add);
    }
    if (assetConfig.getTermBoosts() != null) {
      assetConfig.getTermBoosts().stream()
          .map(this::buildTermBoostFunction)
          .forEach(functions::add);
    }
    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      searchSettings.getGlobalSettings().getFieldValueBoosts().stream()
          .map(this::buildFieldValueBoostFunction)
          .forEach(functions::add);
    }
    if (assetConfig.getFieldValueBoosts() != null) {
      assetConfig.getFieldValueBoosts().stream()
          .map(this::buildFieldValueBoostFunction)
          .forEach(functions::add);
    }

    return functions;
  }

  private void configureFunctionScore(
      FunctionScoreQueryBuilder functionScore, AssetTypeConfiguration assetConfig) {
    if (assetConfig.getScoreMode() != null) {
      functionScore.scoreMode(toScoreMode(assetConfig.getScoreMode().value()));
    } else {
      functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
    }

    if (assetConfig.getBoostMode() != null) {
      functionScore.boostMode(toCombineFunction(assetConfig.getBoostMode().value()));
    } else {
      functionScore.boostMode(CombineFunction.SUM);
    }

    functionScore.boost(FUNCTION_BOOST_FACTOR);
  }

  private HighlightBuilder buildHighlightingIfNeeded(
      String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty()) {
      return null;
    }

    if (assetConfig.getHighlightFields() != null && !assetConfig.getHighlightFields().isEmpty()) {
      return buildHighlights(assetConfig.getHighlightFields());
    } else if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      return buildHighlights(searchSettings.getGlobalSettings().getHighlightFields());
    }

    return null;
  }

  private SearchSourceBuilder createSearchSourceBuilder(QueryBuilder query, int from, int size) {
    int maxHits = searchSettings.getGlobalSettings().getMaxResultHits();
    return new SearchSourceBuilder()
        .query(query)
        .from(Math.min(from, maxHits))
        .size(Math.min(size, maxHits));
  }

  private FunctionScoreQueryBuilder.FilterFunctionBuilder buildTermBoostFunction(TermBoost tb) {
    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(
        QueryBuilders.termQuery(tb.getField(), tb.getValue()),
        ScoreFunctionBuilders.weightFactorFunction(tb.getBoost().floatValue()));
  }

  private FunctionScoreQueryBuilder.FilterFunctionBuilder buildFieldValueBoostFunction(
      FieldValueBoost fvb) {
    QueryBuilder condition = buildConditionQuery(fvb);
    FieldValueFactorFunctionBuilder factorBuilder = buildFieldValueFactorFunction(fvb);
    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(condition, factorBuilder);
  }

  private QueryBuilder buildConditionQuery(FieldValueBoost fvb) {
    if (fvb.getCondition() == null || fvb.getCondition().getRange() == null) {
      return QueryBuilders.matchAllQuery();
    }

    BoolQueryBuilder rangeQuery = QueryBuilders.boolQuery();
    var range = fvb.getCondition().getRange();
    String field = fvb.getField();

    if (range.getGt() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).gt(range.getGt()));
    }
    if (range.getGte() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).gte(range.getGte()));
    }
    if (range.getLt() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).lt(range.getLt()));
    }
    if (range.getLte() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).lte(range.getLte()));
    }

    return rangeQuery;
  }

  private FieldValueFactorFunctionBuilder buildFieldValueFactorFunction(FieldValueBoost fvb) {
    FieldValueFactorFunctionBuilder factorBuilder =
        ScoreFunctionBuilders.fieldValueFactorFunction(fvb.getField())
            .factor(fvb.getFactor().floatValue())
            .missing(fvb.getMissing() == null ? 0.0f : fvb.getMissing().floatValue());

    applyModifier(factorBuilder, fvb.getModifier());
    return factorBuilder;
  }

  private void applyModifier(
      FieldValueFactorFunctionBuilder factorBuilder, FieldValueBoost.Modifier modifier) {
    if (modifier == null) {
      return;
    }

    switch (modifier.value()) {
      case "log" -> factorBuilder.modifier(FieldValueFactorFunction.Modifier.LOG);
      case "log1p" -> {
        try {
          factorBuilder.modifier(FieldValueFactorFunction.Modifier.LOG1P);
        } catch (NoSuchFieldError e) {
          factorBuilder.modifier(FieldValueFactorFunction.Modifier.LOG);
        }
      }
      case "sqrt" -> {
        try {
          factorBuilder.modifier(FieldValueFactorFunction.Modifier.SQRT);
        } catch (NoSuchFieldError ignored) {
          // Modifier not available in this version
        }
      }
      default -> {
        /* No modifier applied */
      }
    }
  }

  private FunctionScoreQuery.ScoreMode toScoreMode(String mode) {
    return switch (mode.toLowerCase()) {
      case "avg" -> FunctionScoreQuery.ScoreMode.AVG;
      case "max" -> FunctionScoreQuery.ScoreMode.MAX;
      case "min" -> FunctionScoreQuery.ScoreMode.MIN;
      case "multiply" -> FunctionScoreQuery.ScoreMode.MULTIPLY;
      case "first" -> FunctionScoreQuery.ScoreMode.FIRST;
      default -> FunctionScoreQuery.ScoreMode.SUM;
    };
  }

  private CombineFunction toCombineFunction(String mode) {
    return switch (mode.toLowerCase()) {
      case "sum" -> CombineFunction.SUM;
      case "avg" -> CombineFunction.AVG;
      case "max" -> CombineFunction.MAX;
      case "min" -> CombineFunction.MIN;
      case "replace" -> CombineFunction.REPLACE;
      default -> CombineFunction.MULTIPLY;
    };
  }

  public HighlightBuilder buildHighlights(List<String> fields) {
    HighlightBuilder hb = new HighlightBuilder();
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    hb.maxAnalyzedOffset(MAX_ANALYZED_OFFSET);
    hb.requireFieldMatch(false);
    for (String field : fields) {
      HighlightBuilder.Field highlightField = new HighlightBuilder.Field(field);
      highlightField.highlighterType("unified");
      hb.field(highlightField);
    }
    return hb;
  }

  private void addConfiguredAggregations(
      SearchSourceBuilder searchSourceBuilder, AssetTypeConfiguration assetConfig) {
    Map<String, Aggregation> aggregations = new HashMap<>();

    // Add asset type aggregations
    aggregations.putAll(
        listOrEmpty(assetConfig.getAggregations()).stream()
            .collect(Collectors.toMap(Aggregation::getName, agg -> agg)));
    // Add global aggregations
    aggregations.putAll(
        listOrEmpty(searchSettings.getGlobalSettings().getAggregations()).stream()
            .collect(Collectors.toMap(Aggregation::getName, agg -> agg)));

    for (var entry : aggregations.entrySet()) {
      Aggregation agg = entry.getValue();
      searchSourceBuilder.aggregation(
          AggregationBuilders.terms(agg.getName())
              .field(agg.getField())
              .size(searchSettings.getGlobalSettings().getMaxAggregateSize()));
    }
  }

  @Override
  public SearchSourceBuilder buildTimeSeriesSearchBuilder(
      String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_result_search_index" -> buildTestCaseResultSearch(query, from, size);
      case "test_case_resolution_status_search_index" -> buildTestCaseResolutionStatusSearch(
          query, from, size);
      case "raw_cost_analysis_report_data_index",
          "aggregated_cost_analysis_report_data_index" -> buildCostAnalysisReportDataSearch(
          query, from, size);
      default -> buildAggregateSearchBuilder(query, from, size);
    };
  }

  @Override
  public SearchSourceBuilder buildCommonSearchBuilder(String query, int from, int size) {
    AssetTypeConfiguration defaultConfig = getOrCreateDefaultConfig();
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, defaultConfig);
    QueryBuilder finalQuery = applyFunctionScoring(baseQuery, defaultConfig);

    return createCommonSearchSourceBuilder(finalQuery, from, size);
  }

  private AssetTypeConfiguration getOrCreateDefaultConfig() {
    AssetTypeConfiguration defaultConfig = searchSettings.getDefaultConfiguration();
    if (defaultConfig == null) {
      defaultConfig = new AssetTypeConfiguration();
      defaultConfig.setAssetType("all");
    }
    return defaultConfig;
  }

  private SearchSourceBuilder createCommonSearchSourceBuilder(
      QueryBuilder query, int from, int size) {
    int maxHits = searchSettings.getGlobalSettings().getMaxResultHits();
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder()
            .query(query)
            .from(Math.min(from, maxHits))
            .size(Math.min(size, maxHits));

    addHighlightsIfConfigured(searchSourceBuilder);
    addAggregation(searchSourceBuilder);

    return searchSourceBuilder;
  }

  private void addHighlightsIfConfigured(SearchSourceBuilder searchSourceBuilder) {
    if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      searchSourceBuilder.highlighter(
          buildHighlights(searchSettings.getGlobalSettings().getHighlightFields()));
    }
  }

  // Add this new method for applying aggregations to NLQ queries
  public SearchSourceBuilder addAggregationsToNLQQuery(
      SearchSourceBuilder searchSourceBuilder, String indexName) {
    // Find the appropriate asset type configuration
    AssetTypeConfiguration assetConfig = findAssetTypeConfig(indexName, searchSettings);

    // Apply aggregations based on asset type and global settings
    addConfiguredAggregations(searchSourceBuilder, assetConfig);

    return searchSourceBuilder;
  }

  @Override
  public SearchSourceBuilder buildEntitySpecificAggregateSearchBuilder(
      String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, compositeConfig);

    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = collectAllBoostFunctions();

    QueryBuilder finalQuery = applyFunctionScoring(baseQuery, functions);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(finalQuery, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private List<FunctionScoreQueryBuilder.FilterFunctionBuilder> collectAllBoostFunctions() {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();

    // Add global boosts
    addGlobalBoosts(functions);

    // Add entity-specific boosts
    addEntitySpecificBoosts(functions);

    return functions;
  }

  private void addGlobalBoosts(List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions) {
    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      searchSettings.getGlobalSettings().getTermBoosts().stream()
          .map(this::buildTermBoostFunction)
          .forEach(functions::add);
    }

    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      searchSettings.getGlobalSettings().getFieldValueBoosts().stream()
          .map(this::buildFieldValueBoostFunction)
          .forEach(functions::add);
    }
  }

  private void addEntitySpecificBoosts(
      List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions) {
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
        addAssetTypeBoosts(functions, assetType, assetConfig);
      }
    }
  }

  private AssetTypeConfiguration findAssetTypeConfig(String assetType) {
    return searchSettings.getAssetTypeConfigurations().stream()
        .filter(config -> config.getAssetType().equals(assetType))
        .findFirst()
        .orElse(null);
  }

  private void addAssetTypeBoosts(
      List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions,
      String assetType,
      AssetTypeConfiguration assetConfig) {

    if (assetConfig.getTermBoosts() != null) {
      assetConfig
          .getTermBoosts()
          .forEach(tb -> functions.add(buildEntitySpecificTermBoost(assetType, tb)));
    }

    if (assetConfig.getFieldValueBoosts() != null) {
      assetConfig
          .getFieldValueBoosts()
          .forEach(fvb -> functions.add(buildEntitySpecificFieldValueBoost(assetType, fvb)));
    }
  }

  private FunctionScoreQueryBuilder.FilterFunctionBuilder buildEntitySpecificTermBoost(
      String assetType, TermBoost tb) {
    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery("entityType", assetType))
            .must(QueryBuilders.termQuery(tb.getField(), tb.getValue())),
        ScoreFunctionBuilders.weightFactorFunction(tb.getBoost().floatValue()));
  }

  private FunctionScoreQueryBuilder.FilterFunctionBuilder buildEntitySpecificFieldValueBoost(
      String assetType, FieldValueBoost fvb) {
    BoolQueryBuilder condition =
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("entityType", assetType));

    if (fvb.getCondition() != null && fvb.getCondition().getRange() != null) {
      BoolQueryBuilder rangeQuery = buildRangeQuery(fvb);
      condition.must(rangeQuery);
    }

    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(
        condition, buildFieldValueBoostFunction(fvb).getScoreFunction());
  }

  private BoolQueryBuilder buildRangeQuery(FieldValueBoost fvb) {
    BoolQueryBuilder rangeQuery = QueryBuilders.boolQuery();
    var range = fvb.getCondition().getRange();
    String field = fvb.getField();

    if (range.getGt() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).gt(range.getGt()));
    }
    if (range.getGte() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).gte(range.getGte()));
    }
    if (range.getLt() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).lt(range.getLt()));
    }
    if (range.getLte() != null) {
      rangeQuery.filter(QueryBuilders.rangeQuery(field).lte(range.getLte()));
    }

    return rangeQuery;
  }

  private QueryBuilder applyFunctionScoring(
      QueryBuilder baseQuery, List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions) {

    if (functions.isEmpty()) {
      return baseQuery;
    }

    FunctionScoreQueryBuilder functionScore =
        QueryBuilders.functionScoreQuery(
            baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));

    functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
    functionScore.boostMode(CombineFunction.SUM);
    functionScore.boost(FUNCTION_BOOST_FACTOR);

    return functionScore;
  }

  private AssetTypeConfiguration buildCompositeAssetConfig(SearchSettings searchSettings) {
    // Create a composite configuration that merges all asset type configurations
    AssetTypeConfiguration compositeConfig = new AssetTypeConfiguration();
    compositeConfig.setAssetType("all");

    List<FieldBoost> allFields = new ArrayList<>();
    List<TermBoost> allTermBoosts = new ArrayList<>();
    List<FieldValueBoost> allFieldValueBoosts = new ArrayList<>();

    // Merge fields from all relevant asset configurations
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

  private QueryBuilder buildQueryWithMatchTypes(String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return QueryBuilders.boolQuery().must(QueryBuilders.matchAllQuery());
    }

    if (containsQuerySyntax(query)) {
      return buildComplexQuery(query, assetConfig);
    }

    return buildSimpleQueryWithTypes(query, assetConfig);
  }

  private QueryBuilder buildComplexQuery(String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> allFields = extractAllFields(assetConfig);

    QueryStringQueryBuilder queryStringBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(allFields)
            .type(MOST_FIELDS)
            .defaultOperator(Operator.AND)
            .analyzeWildcard(true)
            .allowLeadingWildcard(true)
            .fuzzyMaxExpansions(50)
            .tieBreaker(DEFAULT_TIE_BREAKER);

    return QueryBuilders.boolQuery().must(queryStringBuilder);
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

  private QueryBuilder buildSimpleQueryWithTypes(String query, AssetTypeConfiguration assetConfig) {
    BoolQueryBuilder combinedQuery = QueryBuilders.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByType = groupFieldsByMatchType(assetConfig);

    addMatchTypeQueries(combinedQuery, query, fieldsByType, multipliers);

    combinedQuery.minimumShouldMatch(1);
    return QueryBuilders.boolQuery().must(combinedQuery);
  }

  private void addMatchTypeQueries(
      BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Map<String, Float>> fieldsByType,
      MatchTypeMultipliers multipliers) {

    addExactMatchQueries(
        combinedQuery, query, fieldsByType.get(MATCH_TYPE_EXACT), multipliers.exactMatch);
    addPhraseMatchQueries(
        combinedQuery, query, fieldsByType.get(MATCH_TYPE_PHRASE), multipliers.phraseMatch);
    addFuzzyMatchQueries(
        combinedQuery, query, fieldsByType.get(MATCH_TYPE_FUZZY), multipliers.fuzzyMatch);
    addStandardMatchQueries(combinedQuery, query, fieldsByType.get(MATCH_TYPE_STANDARD));
  }
}
