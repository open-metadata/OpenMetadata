package org.openmetadata.service.search.elasticsearch;

import static es.org.elasticsearch.index.query.MultiMatchQueryBuilder.Type.MOST_FIELDS;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_ANALYZED_OFFSET;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static org.openmetadata.service.search.SearchUtil.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtil.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtil.isServiceIndex;
import static org.openmetadata.service.search.SearchUtil.isTimeSeriesIndex;

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
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
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
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;
import org.openmetadata.service.search.indexes.TestCaseResultIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ElasticSearchSourceBuilderFactory
    implements SearchSourceBuilderFactory<
        SearchSourceBuilder, QueryBuilder, HighlightBuilder, FunctionScoreQueryBuilder> {

  private static final Logger LOG =
      LoggerFactory.getLogger(ElasticSearchSourceBuilderFactory.class);

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
            .fuzziness(Fuzziness.ONE)
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
      QueryBuilder query, HighlightBuilder highlightBuilder, int fromOffset, int size) {
    SearchSourceBuilder builder = new SearchSourceBuilder();
    builder.query(query);
    if (highlightBuilder != null) {
      builder.highlighter(highlightBuilder);
    }
    builder.from(fromOffset);
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
            agg -> {
              TermsAggregationBuilder termsAgg =
                  AggregationBuilders.terms(agg.getName())
                      .size(searchSettings.getGlobalSettings().getMaxAggregateSize());

              if (!nullOrEmpty(agg.getField())) {
                termsAgg.field(agg.getField());
              }

              if (!nullOrEmpty(agg.getScript())) {
                termsAgg.script(new es.org.elasticsearch.script.Script(agg.getScript()));
              }

              searchSourceBuilder.aggregation(termsAgg);
            });
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
        .fuzziness(Fuzziness.ONE)
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
              .fuzziness(Fuzziness.ONE)
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
        .fuzziness(Fuzziness.ONE)
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

      TermsAggregationBuilder termsAgg =
          AggregationBuilders.terms(agg.getName())
              .size(searchSettings.getGlobalSettings().getMaxAggregateSize());

      if (!nullOrEmpty(agg.getField())) {
        termsAgg.field(agg.getField());
      }

      if (!nullOrEmpty(agg.getScript())) {
        termsAgg.script(new es.org.elasticsearch.script.Script(agg.getScript()));
      }

      searchSourceBuilder.aggregation(termsAgg);
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

  public es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildSearchQueryBuilderV2(
      String query, Map<String, Float> fields) {
    Map<String, Float> fuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    Map<String, Float> nonFuzzyFields =
        fields.entrySet().stream()
            .filter(entry -> isNonFuzzyField(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    es.co.elastic.clients.elasticsearch._types.query_dsl.Query fuzzyQuery =
        ElasticQueryBuilder.queryStringQuery(
            query,
            fuzzyFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.And,
            "1",
            10,
            3,
            DEFAULT_TIE_BREAKER,
            es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields);

    es.co.elastic.clients.elasticsearch._types.query_dsl.Query nonFuzzyQuery =
        ElasticQueryBuilder.multiMatchQuery(
            query,
            nonFuzzyFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.And,
            String.valueOf(DEFAULT_TIE_BREAKER),
            "0");

    return ElasticQueryBuilder.boolQuery()
        .should(fuzzyQuery)
        .should(nonFuzzyQuery)
        .minimumShouldMatch(1)
        .build();
  }

  public ElasticSearchRequestBuilder searchBuilderV2(
      es.co.elastic.clients.elasticsearch._types.query_dsl.Query query,
      es.co.elastic.clients.elasticsearch.core.search.Highlight highlightBuilder,
      int fromOffset,
      int size) {
    ElasticSearchRequestBuilder builder = new ElasticSearchRequestBuilder();
    builder.query(query);
    if (highlightBuilder != null) {
      builder.highlighter(highlightBuilder);
    }
    builder.from(fromOffset);
    builder.size(size);
    return builder;
  }

  public ElasticSearchRequestBuilder buildUserOrTeamSearchBuilderV2(
      String query, int from, int size) {
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, UserIndex.getFields());
    return searchBuilderV2(queryBuilder, null, from, size);
  }

  private ElasticSearchRequestBuilder addAggregationV2(
      ElasticSearchRequestBuilder searchRequestBuilder) {
    searchSettings
        .getGlobalSettings()
        .getAggregations()
        .forEach(
            agg -> {
              es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation termsAgg;
              int maxSize = searchSettings.getGlobalSettings().getMaxAggregateSize();

              if (!nullOrEmpty(agg.getField())) {
                termsAgg = ElasticAggregationBuilder.termsAggregation(agg.getField(), maxSize);
              } else if (!nullOrEmpty(agg.getScript())) {
                termsAgg =
                    ElasticAggregationBuilder.termsAggregationWithScript(agg.getScript(), maxSize);
              } else {
                return;
              }

              searchRequestBuilder.aggregation(agg.getName(), termsAgg);
            });
    return searchRequestBuilder;
  }

  public es.co.elastic.clients.elasticsearch.core.search.Highlight buildHighlightsV2(
      List<String> fields) {
    ElasticHighlightBuilder hb = new ElasticHighlightBuilder();
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    for (String field : listOrEmpty(fields)) {
      hb.field(field, MAX_ANALYZED_OFFSET);
    }
    return hb.build();
  }

  public ElasticSearchRequestBuilder getSearchSourceBuilderV2(
      String indexName, String searchQuery, int fromOffset, int size) {
    return getSearchSourceBuilderV2(indexName, searchQuery, fromOffset, size, false);
  }

  public ElasticSearchRequestBuilder getSearchSourceBuilderV2(
      String indexName, String searchQuery, int fromOffset, int size, boolean includeExplain) {
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
          indexName, searchQuery, fromOffset, size, includeExplain);
    }

    if (indexName.equals("all") || indexName.equals("dataAsset")) {
      return buildDataAssetSearchBuilderV2(
          indexName, searchQuery, fromOffset, size, includeExplain);
    }

    return switch (indexName) {
      case "user_search_index",
          "user",
          "team_search_index",
          "team" -> buildUserOrTeamSearchBuilderV2(searchQuery, fromOffset, size);
      default -> buildAggregateSearchBuilderV2(searchQuery, fromOffset, size);
    };
  }

  public ElasticSearchRequestBuilder buildTimeSeriesSearchBuilderV2(
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

  public ElasticSearchRequestBuilder buildServiceSearchBuilderV2(String query, int from, int size) {
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, SearchIndex.getDefaultFields());
    es.co.elastic.clients.elasticsearch.core.search.Highlight hb =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, hb, from, size);
  }

  public ElasticSearchRequestBuilder buildDataAssetSearchBuilderV2(
      String indexName, String query, int from, int size) {
    return buildDataAssetSearchBuilderV2(indexName, query, from, size, false);
  }

  public ElasticSearchRequestBuilder buildDataAssetSearchBuilderV2(
      String indexName, String query, int from, int size, boolean explain) {
    AssetTypeConfiguration assetConfig = getAssetConfiguration(indexName);
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery =
        buildBaseQueryV2(query, assetConfig);
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query finalQuery =
        applyFunctionScoringV2(baseQuery, assetConfig);
    es.co.elastic.clients.elasticsearch.core.search.Highlight highlightBuilder =
        buildHighlightingIfNeededV2(query, assetConfig);

    ElasticSearchRequestBuilder searchRequestBuilder =
        createSearchSourceBuilderV2(finalQuery, from, size);
    if (highlightBuilder != null) {
      searchRequestBuilder.highlighter(highlightBuilder);
    }

    addConfiguredAggregationsV2(searchRequestBuilder, assetConfig);
    searchRequestBuilder.explain(explain);

    return searchRequestBuilder;
  }

  public ElasticSearchRequestBuilder buildAggregateSearchBuilderV2(
      String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, compositeConfig);
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query finalQuery =
        applyFunctionScoringV2(baseQuery, compositeConfig);

    ElasticSearchRequestBuilder searchRequestBuilder =
        searchBuilderV2(finalQuery, null, from, size);
    return addAggregationV2(searchRequestBuilder);
  }

  public ElasticSearchRequestBuilder buildDataQualitySearchBuilderV2(
      String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearchV2(query, from, size);
      default -> buildAggregateSearchBuilderV2(query, from, size);
    };
  }

  public ElasticSearchRequestBuilder buildTestCaseSearchV2(String query, int from, int size) {
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseIndex.getFields());
    es.co.elastic.clients.elasticsearch.core.search.Highlight hb =
        buildHighlightsV2(List.of("testSuite.name", "testSuite.description"));
    return searchBuilderV2(queryBuilder, hb, from, size);
  }

  public ElasticSearchRequestBuilder buildTestCaseResultSearchV2(String query, int from, int size) {
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseResultIndex.getFields());
    es.co.elastic.clients.elasticsearch.core.search.Highlight hb =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, hb, from, size);
  }

  public ElasticSearchRequestBuilder buildTestCaseResolutionStatusSearchV2(
      String query, int from, int size) {
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseResolutionStatusIndex.getFields());
    es.co.elastic.clients.elasticsearch.core.search.Highlight hb =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, hb, from, size);
  }

  public ElasticSearchRequestBuilder buildCostAnalysisReportDataSearchV2(
      String query, int from, int size) {
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryBuilder =
        ElasticQueryBuilder.queryStringQuery(query);
    return searchBuilderV2(queryBuilder, null, from, size);
  }

  public ElasticSearchRequestBuilder buildCommonSearchBuilderV2(String query, int from, int size) {
    AssetTypeConfiguration defaultConfig = getOrCreateDefaultConfig();
    LOG.debug(
        "buildCommonSearchBuilder called with query: '{}', using config: {}",
        query,
        defaultConfig.getAssetType());

    es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, defaultConfig);
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query finalQuery =
        applyGlobalBoostsV2(baseQuery);

    ElasticSearchRequestBuilder searchRequestBuilder =
        createCommonSearchSourceBuilderV2(finalQuery, from, size);
    addHighlightsIfConfiguredV2(searchRequestBuilder);
    addAggregationV2(searchRequestBuilder);

    return searchRequestBuilder;
  }

  public ElasticSearchRequestBuilder buildEntitySpecificAggregateSearchBuilderV2(
      String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, compositeConfig);

    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = collectAllBoostFunctions();
    es.co.elastic.clients.elasticsearch._types.query_dsl.Query finalQuery =
        applyBoostFunctionsV2(baseQuery, functions);

    ElasticSearchRequestBuilder searchRequestBuilder =
        searchBuilderV2(finalQuery, null, from, size);
    return addAggregationV2(searchRequestBuilder);
  }

  private List<FunctionScoreQueryBuilder.FilterFunctionBuilder> collectGlobalBoostFunctions() {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();
    addGlobalBoosts(functions);
    return functions;
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildBaseQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return ElasticQueryBuilder.boolQuery().must(ElasticQueryBuilder.matchAllQuery()).build();
    } else if (containsQuerySyntax(query)) {
      return buildComplexSyntaxQueryV2(query, assetConfig);
    } else {
      return buildSimpleQueryV2(query, assetConfig);
    }
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildComplexSyntaxQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> fuzzyFields = new HashMap<>();
    Map<String, Float> nonFuzzyFields = new HashMap<>();

    classifyFields(assetConfig, fuzzyFields, nonFuzzyFields);

    es.co.elastic.clients.elasticsearch._types.query_dsl.Query fuzzyQuery =
        ElasticQueryBuilder.queryStringQuery(
            query,
            fuzzyFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.And,
            "1",
            10,
            3,
            DEFAULT_TIE_BREAKER,
            es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields);

    es.co.elastic.clients.elasticsearch._types.query_dsl.Query nonFuzzyQuery =
        ElasticQueryBuilder.multiMatchQuery(
            query,
            nonFuzzyFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.And,
            String.valueOf(DEFAULT_TIE_BREAKER),
            "0");

    return ElasticQueryBuilder.boolQuery()
        .should(fuzzyQuery)
        .should(nonFuzzyQuery)
        .minimumShouldMatch(1)
        .must(ElasticQueryBuilder.matchAllQuery())
        .build();
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildSimpleQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    ElasticQueryBuilder.BoolQueryBuilder combinedQuery = ElasticQueryBuilder.boolQuery();
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
    return ElasticQueryBuilder.boolQuery().must(combinedQuery.build()).build();
  }

  private void addExactMatchQueriesV2(
      ElasticQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Float> fields,
      float multiplier) {
    if (!fields.isEmpty()) {
      ElasticQueryBuilder.BoolQueryBuilder exactMatchQuery = ElasticQueryBuilder.boolQuery();
      fields.forEach(
          (field, boost) ->
              exactMatchQuery.should(
                  es.co.elastic.clients.elasticsearch._types.query_dsl.Query.of(
                      q ->
                          q.term(
                              t ->
                                  t.field(field)
                                      .value(query.toLowerCase())
                                      .boost((float) (boost * multiplier))))));
      if (!exactMatchQuery.build()._kind().name().equals("match_none")) {
        combinedQuery.should(exactMatchQuery.build());
      }
    }
  }

  private void addPhraseMatchQueriesV2(
      ElasticQueryBuilder.BoolQueryBuilder combinedQuery,
      String query,
      Map<String, Float> fields,
      float multiplier) {
    if (!fields.isEmpty()) {
      ElasticQueryBuilder.BoolQueryBuilder phraseMatchQuery = ElasticQueryBuilder.boolQuery();
      fields.forEach(
          (field, boost) ->
              phraseMatchQuery.should(
                  es.co.elastic.clients.elasticsearch._types.query_dsl.Query.of(
                      q ->
                          q.matchPhrase(
                              m ->
                                  m.field(field)
                                      .query(query)
                                      .boost((float) (boost * multiplier))))));
      if (!phraseMatchQuery.build()._kind().name().equals("match_none")) {
        combinedQuery.should(phraseMatchQuery.build());
      }
    }
  }

  private void addFuzzyMatchQueriesV2(
      ElasticQueryBuilder.BoolQueryBuilder combinedQuery,
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

      es.co.elastic.clients.elasticsearch._types.query_dsl.Query fuzzyQuery =
          es.co.elastic.clients.elasticsearch._types.query_dsl.Query.of(
              q ->
                  q.multiMatch(
                      m ->
                          m.query(query)
                              .fields(fieldList)
                              .type(
                                  es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType
                                      .MostFields)
                              .fuzziness("1")
                              .maxExpansions(10)
                              .prefixLength(1)
                              .operator(
                                  es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.Or)
                              .minimumShouldMatch(MINIMUM_SHOULD_MATCH)
                              .tieBreaker((double) DEFAULT_TIE_BREAKER)
                              .boost(multiplier)));
      combinedQuery.should(fuzzyQuery);
    }
  }

  private void addStandardMatchQueriesV2(
      ElasticQueryBuilder.BoolQueryBuilder combinedQuery,
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
        es.co.elastic.clients.elasticsearch._types.query_dsl.Query fuzzyQueryBuilder =
            createStandardFuzzyQueryV2(query, fuzzyFields);
        combinedQuery.should(fuzzyQueryBuilder);
      }

      if (!nonFuzzyFields.isEmpty()) {
        es.co.elastic.clients.elasticsearch._types.query_dsl.Query nonFuzzyQueryBuilder =
            createStandardNonFuzzyQueryV2(query, nonFuzzyFields);
        combinedQuery.should(nonFuzzyQueryBuilder);
      }
    }
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query createStandardFuzzyQueryV2(
      String query, Map<String, Float> fields) {
    return ElasticQueryBuilder.multiMatchQuery(
        query,
        fields,
        es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields,
        es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.Or,
        String.valueOf(DEFAULT_TIE_BREAKER),
        "1");
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query createStandardNonFuzzyQueryV2(
      String query, Map<String, Float> fields) {
    return ElasticQueryBuilder.multiMatchQuery(
        query,
        fields,
        es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields,
        es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.And,
        String.valueOf(DEFAULT_TIE_BREAKER),
        "0");
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query applyFunctionScoringV2(
      es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery,
      AssetTypeConfiguration assetConfig) {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions =
        collectBoostFunctions(assetConfig);

    if (functions.isEmpty()) {
      return baseQuery;
    }

    return baseQuery;
  }

  private es.co.elastic.clients.elasticsearch.core.search.Highlight buildHighlightingIfNeededV2(
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

  private ElasticSearchRequestBuilder createSearchSourceBuilderV2(
      es.co.elastic.clients.elasticsearch._types.query_dsl.Query query, int from, int size) {
    int maxHits = searchSettings.getGlobalSettings().getMaxResultHits();
    ElasticSearchRequestBuilder builder = new ElasticSearchRequestBuilder();
    builder.query(query);
    builder.from(Math.min(from, maxHits));
    builder.size(Math.min(size, maxHits));
    return builder;
  }

  private void addConfiguredAggregationsV2(
      ElasticSearchRequestBuilder searchRequestBuilder, AssetTypeConfiguration assetConfig) {
    Map<String, Aggregation> aggregations = new HashMap<>();

    aggregations.putAll(
        listOrEmpty(assetConfig.getAggregations()).stream()
            .collect(Collectors.toMap(Aggregation::getName, agg -> agg)));
    aggregations.putAll(
        listOrEmpty(searchSettings.getGlobalSettings().getAggregations()).stream()
            .collect(Collectors.toMap(Aggregation::getName, agg -> agg)));

    for (var entry : aggregations.entrySet()) {
      Aggregation agg = entry.getValue();
      es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation termsAgg;
      int maxSize = searchSettings.getGlobalSettings().getMaxAggregateSize();

      if (!nullOrEmpty(agg.getField())) {
        termsAgg = ElasticAggregationBuilder.termsAggregation(agg.getField(), maxSize);
      } else if (!nullOrEmpty(agg.getScript())) {
        termsAgg = ElasticAggregationBuilder.termsAggregationWithScript(agg.getScript(), maxSize);
      } else {
        continue;
      }

      searchRequestBuilder.aggregation(agg.getName(), termsAgg);
    }
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildQueryWithMatchTypesV2(
      String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return ElasticQueryBuilder.boolQuery().must(ElasticQueryBuilder.matchAllQuery()).build();
    }

    if (containsQuerySyntax(query)) {
      return buildComplexQueryV2(query, assetConfig);
    }

    return buildSimpleQueryWithTypesV2(query, assetConfig);
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildComplexQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    Map<String, Float> allFields = extractAllFields(assetConfig);

    es.co.elastic.clients.elasticsearch._types.query_dsl.Query queryStringBuilder =
        ElasticQueryBuilder.queryStringQuery(
            query,
            allFields,
            es.co.elastic.clients.elasticsearch._types.query_dsl.Operator.And,
            null,
            50,
            0,
            0.5,
            es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.MostFields);

    return ElasticQueryBuilder.boolQuery().must(queryStringBuilder).build();
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query buildSimpleQueryWithTypesV2(
      String query, AssetTypeConfiguration assetConfig) {
    ElasticQueryBuilder.BoolQueryBuilder combinedQuery = ElasticQueryBuilder.boolQuery();
    MatchTypeMultipliers multipliers = getMatchTypeMultipliers(assetConfig);
    Map<String, Map<String, Float>> fieldsByType = groupFieldsByMatchType(assetConfig);

    addMatchTypeQueriesV2(combinedQuery, query, fieldsByType, multipliers);

    combinedQuery.minimumShouldMatch(1);
    return ElasticQueryBuilder.boolQuery().must(combinedQuery.build()).build();
  }

  private void addMatchTypeQueriesV2(
      ElasticQueryBuilder.BoolQueryBuilder combinedQuery,
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

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query applyGlobalBoostsV2(
      es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery) {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = collectGlobalBoostFunctions();

    if (functions.isEmpty()) {
      return baseQuery;
    }

    return baseQuery;
  }

  private ElasticSearchRequestBuilder createCommonSearchSourceBuilderV2(
      es.co.elastic.clients.elasticsearch._types.query_dsl.Query query, int from, int size) {
    return createSearchSourceBuilderV2(query, from, size);
  }

  private void addHighlightsIfConfiguredV2(ElasticSearchRequestBuilder searchRequestBuilder) {
    if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      searchRequestBuilder.highlighter(
          buildHighlightsV2(searchSettings.getGlobalSettings().getHighlightFields()));
    }
  }

  private es.co.elastic.clients.elasticsearch._types.query_dsl.Query applyBoostFunctionsV2(
      es.co.elastic.clients.elasticsearch._types.query_dsl.Query baseQuery,
      List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions) {
    if (functions.isEmpty()) {
      return baseQuery;
    }

    return baseQuery;
  }
}
