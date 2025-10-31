package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static os.org.opensearch.index.query.MultiMatchQueryBuilder.Type.MOST_FIELDS;

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
import os.org.opensearch.common.lucene.search.function.CombineFunction;
import os.org.opensearch.common.lucene.search.function.FieldValueFactorFunction;
import os.org.opensearch.common.lucene.search.function.FunctionScoreQuery;
import os.org.opensearch.common.unit.Fuzziness;
import os.org.opensearch.index.query.BoolQueryBuilder;
import os.org.opensearch.index.query.MultiMatchQueryBuilder;
import os.org.opensearch.index.query.Operator;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.index.query.QueryStringQueryBuilder;
import os.org.opensearch.index.query.functionscore.FieldValueFactorFunctionBuilder;
import os.org.opensearch.index.query.functionscore.FunctionScoreQueryBuilder;
import os.org.opensearch.index.query.functionscore.ScoreFunctionBuilders;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import os.org.opensearch.search.builder.SearchSourceBuilder;
import os.org.opensearch.search.fetch.subphase.highlight.HighlightBuilder;

@Slf4j
public class OpenSearchSourceBuilderFactory
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
            .tieBreaker(0.5f);

    MultiMatchQueryBuilder nonFuzzyQueryBuilder =
        QueryBuilders.multiMatchQuery(query)
            .fields(nonFuzzyFields)
            .type(MOST_FIELDS)
            .operator(Operator.AND)
            .tieBreaker(0.5f)
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
                termsAgg.script(new os.org.opensearch.script.Script(agg.getScript()));
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
    AssetTypeConfiguration compositeConfig = getOrBuildCompositeConfig();
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
      return getOrBuildCompositeConfig(); // Use cached version!
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
                    fieldBoost.getBoost() != null
                        ? fieldBoost.getBoost().floatValue()
                        : DEFAULT_BOOST;
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
        .operator(Operator.AND)
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
    QueryBuilder condition = buildConditionForFieldValueBoost(fvb);
    FieldValueFactorFunctionBuilder factorBuilder = createFieldValueFactorFunction(fvb);
    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(condition, factorBuilder);
  }

  private QueryBuilder buildConditionForFieldValueBoost(FieldValueBoost fvb) {
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

  private FieldValueFactorFunctionBuilder createFieldValueFactorFunction(FieldValueBoost fvb) {
    FieldValueFactorFunctionBuilder factorBuilder =
        ScoreFunctionBuilders.fieldValueFactorFunction(fvb.getField())
            .factor(fvb.getFactor().floatValue())
            .missing(fvb.getMissing() == null ? 0.0f : fvb.getMissing().floatValue());

    if (fvb.getModifier() != null) {
      String modifierValue = fvb.getModifier().value();
      switch (modifierValue) {
        case "log":
          factorBuilder.modifier(FieldValueFactorFunction.Modifier.LOG);
          break;
        case "log1p":
          try {
            factorBuilder.modifier(FieldValueFactorFunction.Modifier.LOG1P);
          } catch (NoSuchFieldError e) {
            factorBuilder.modifier(FieldValueFactorFunction.Modifier.LOG);
          }
          break;
        case "sqrt":
          try {
            factorBuilder.modifier(FieldValueFactorFunction.Modifier.SQRT);
          } catch (NoSuchFieldError ignored) {
            // Modifier not supported
          }
          break;
        default:
          // No modifier
          break;
      }
    }

    return factorBuilder;
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
        termsAgg.script(new os.org.opensearch.script.Script(agg.getScript()));
      }

      searchSourceBuilder.aggregation(termsAgg);
    }
  }

  @Override
  public SearchSourceBuilder buildCommonSearchBuilder(String query, int from, int size) {
    AssetTypeConfiguration defaultConfig = getOrCreateDefaultConfig();
    LOG.debug(
        "buildCommonSearchBuilder called with query: '{}', using config: {}",
        query,
        defaultConfig.getAssetType());

    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, defaultConfig);
    QueryBuilder finalQuery = applyGlobalBoosts(baseQuery);

    SearchSourceBuilder searchSourceBuilder =
        createCommonSearchSourceBuilder(finalQuery, from, size);
    addHighlightsIfConfigured(searchSourceBuilder);
    addAggregation(searchSourceBuilder);

    return searchSourceBuilder;
  }

  private AssetTypeConfiguration getOrCreateDefaultConfig() {
    AssetTypeConfiguration defaultConfig = searchSettings.getDefaultConfiguration();
    if (defaultConfig == null) {
      defaultConfig = new AssetTypeConfiguration();
      defaultConfig.setAssetType("all");
    }
    return defaultConfig;
  }

  private QueryBuilder applyGlobalBoosts(QueryBuilder baseQuery) {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = collectGlobalBoostFunctions();

    if (functions.isEmpty()) {
      return baseQuery;
    }

    FunctionScoreQueryBuilder functionScore =
        QueryBuilders.functionScoreQuery(
            baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));
    functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
    functionScore.boostMode(CombineFunction.MULTIPLY);

    return functionScore;
  }

  private List<FunctionScoreQueryBuilder.FilterFunctionBuilder> collectGlobalBoostFunctions() {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();

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

    return functions;
  }

  private SearchSourceBuilder createCommonSearchSourceBuilder(
      QueryBuilder query, int from, int size) {
    return createSearchSourceBuilder(query, from, size);
  }

  private void addHighlightsIfConfigured(SearchSourceBuilder searchSourceBuilder) {
    if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      searchSourceBuilder.highlighter(
          buildHighlights(searchSettings.getGlobalSettings().getHighlightFields()));
    }
  }

  public SearchSourceBuilder addAggregationsToNLQQuery(
      SearchSourceBuilder searchSourceBuilder, String indexName) {
    AssetTypeConfiguration assetConfig = findAssetTypeConfig(indexName, searchSettings);
    addConfiguredAggregations(searchSourceBuilder, assetConfig);
    return searchSourceBuilder;
  }

  @Override
  public SearchSourceBuilder buildEntitySpecificAggregateSearchBuilder(
      String query, int from, int size) {
    AssetTypeConfiguration compositeConfig = getOrBuildCompositeConfig();
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, compositeConfig);

    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = collectAllBoostFunctions();
    QueryBuilder finalQuery = applyBoostFunctions(baseQuery, functions);

    SearchSourceBuilder searchSourceBuilder = searchBuilder(finalQuery, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private List<FunctionScoreQueryBuilder.FilterFunctionBuilder> collectAllBoostFunctions() {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();

    addGlobalBoostFunctions(functions);
    addEntitySpecificBoostFunctions(functions);

    return functions;
  }

  private void addGlobalBoostFunctions(
      List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions) {
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

  private void addEntitySpecificBoostFunctions(
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
      AssetTypeConfiguration assetConfig = findAssetConfig(assetType);
      if (assetConfig != null) {
        addEntityTermBoosts(functions, assetType, assetConfig);
        addEntityFieldValueBoosts(functions, assetType, assetConfig);
      }
    }
  }

  private AssetTypeConfiguration findAssetConfig(String assetType) {
    return searchSettings.getAssetTypeConfigurations().stream()
        .filter(config -> config.getAssetType().equals(assetType))
        .findFirst()
        .orElse(null);
  }

  private void addEntityTermBoosts(
      List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions,
      String assetType,
      AssetTypeConfiguration assetConfig) {
    if (assetConfig.getTermBoosts() == null) {
      return;
    }

    for (TermBoost tb : assetConfig.getTermBoosts()) {
      BoolQueryBuilder filterQuery =
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery("entityType", assetType))
              .must(QueryBuilders.termQuery(tb.getField(), tb.getValue()));

      functions.add(
          new FunctionScoreQueryBuilder.FilterFunctionBuilder(
              filterQuery, ScoreFunctionBuilders.weightFactorFunction(tb.getBoost().floatValue())));
    }
  }

  private void addEntityFieldValueBoosts(
      List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions,
      String assetType,
      AssetTypeConfiguration assetConfig) {
    if (assetConfig.getFieldValueBoosts() == null) {
      return;
    }

    for (FieldValueBoost fvb : assetConfig.getFieldValueBoosts()) {
      BoolQueryBuilder condition = createEntityCondition(assetType, fvb);
      functions.add(
          new FunctionScoreQueryBuilder.FilterFunctionBuilder(
              condition, buildFieldValueBoostFunction(fvb).getScoreFunction()));
    }
  }

  private BoolQueryBuilder createEntityCondition(String assetType, FieldValueBoost fvb) {
    BoolQueryBuilder condition =
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("entityType", assetType));

    if (fvb.getCondition() != null && fvb.getCondition().getRange() != null) {
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

      condition.must(rangeQuery);
    }

    return condition;
  }

  private QueryBuilder applyBoostFunctions(
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
            .tieBreaker(0.5f);

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
      String index, String q, int offset, int limit, boolean explain) {
    String resolvedIndex = Entity.getSearchRepository().getIndexNameWithoutAlias(index);

    switch (resolvedIndex) {
      case "user-search-index":
      case "team-search-index":
        return buildUserOrTeamSearchBuilderV2(q, offset, limit);
      case "test_case_search_index":
      case "testCase":
      case "test_suite_search_index":
      case "testSuite":
        return buildTestCaseSearchBuilderV2(q, offset, limit);
      case "test_case_resolution_status_search_index":
        return buildTestCaseResolutionStatusSearchBuilderV2(q, offset, limit);
      case "test_case_result_search_index":
        return buildTestCaseResultSearchBuilderV2(q, offset, limit);
      case "raw_cost_analysis_report_data_index":
      case "aggregated_cost_analysis_report_data_index":
        return buildCostAnalysisReportDataSearchBuilderV2(q, offset, limit);
      case "glossaryterm_search_index":
      case "tag_search_index":
      case "dashboard_search_index":
      case "pipeline_search_index":
      case "topic_search_index":
      case "mlmodel_search_index":
      case "container_search_index":
      case "query_search_index":
      case "stored_procedure_search_index":
      case "dashboard_data_model_search_index":
      case "glossary_search_index":
      case "table_search_index":
      case "database_search_index":
      case "database_schema_search_index":
      case "data_product_search_index":
      case "search_index_search_index":
      case "domain_search_index":
        return buildDataAssetSearchBuilderV2(index, q, offset, limit, explain);
      default:
        if (resolvedIndex.equals("all") || resolvedIndex.equals("dataAsset")) {
          return buildAggregateSearchBuilderV2(q, offset, limit);
        } else {
          return buildServiceSearchBuilderV2(q, offset, limit);
        }
    }
  }

  public OpenSearchRequestBuilder buildTestCaseSearchBuilderV2(String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseIndex.getFields());
    os.org.opensearch.client.opensearch.core.search.Highlight highlighter =
        buildHighlightsV2(List.of("testSuite.name", "testSuite.description"));
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildCostAnalysisReportDataSearchBuilderV2(
      String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        OpenSearchQueryBuilder.queryStringQuery(query);
    return searchBuilderV2(queryBuilder, null, from, size);
  }

  public OpenSearchRequestBuilder buildTestCaseResolutionStatusSearchBuilderV2(
      String query, int from, int size) {
    os.org.opensearch.client.opensearch._types.query_dsl.Query queryBuilder =
        buildSearchQueryBuilderV2(query, TestCaseResolutionStatusIndex.getFields());
    os.org.opensearch.client.opensearch.core.search.Highlight highlighter =
        buildHighlightsV2(new ArrayList<>());
    return searchBuilderV2(queryBuilder, highlighter, from, size);
  }

  public OpenSearchRequestBuilder buildTestCaseResultSearchBuilderV2(
      String query, int from, int size) {
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
    AssetTypeConfiguration compositeConfig = getOrBuildCompositeConfig();
    os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery =
        buildQueryWithMatchTypesV2(query, compositeConfig);
    os.org.opensearch.client.opensearch._types.query_dsl.Query finalQuery =
        applyFunctionScoringV2(baseQuery, compositeConfig);

    OpenSearchRequestBuilder searchRequestBuilder = searchBuilderV2(finalQuery, null, from, size);
    return addAggregationV2(searchRequestBuilder);
  }

  public OpenSearchRequestBuilder buildDataAssetSearchBuilderV2(
      String indexName, String query, int from, int size, boolean explain) {
    AssetTypeConfiguration assetConfig = getAssetConfiguration(indexName);
    os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery =
        buildBaseQueryV2(query, assetConfig);
    os.org.opensearch.client.opensearch._types.query_dsl.Query finalQuery =
        applyFunctionScoringV2(baseQuery, assetConfig);
    os.org.opensearch.client.opensearch.core.search.Highlight highlightBuilder =
        buildHighlightingIfNeededV2(query, assetConfig);

    OpenSearchRequestBuilder searchRequestBuilder =
        createSearchRequestBuilderV2(finalQuery, from, size);
    if (highlightBuilder != null) {
      searchRequestBuilder.highlighter(highlightBuilder);
    }

    addConfiguredAggregationsV2(searchRequestBuilder, assetConfig);

    return searchRequestBuilder;
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildBaseQueryV2(
      String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return OpenSearchQueryBuilder.matchAllQuery();
    } else {
      return buildQueryWithMatchTypesV2(query, assetConfig);
    }
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query buildQueryWithMatchTypesV2(
      String query, AssetTypeConfiguration assetConfig) {
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      return OpenSearchQueryBuilder.matchAllQuery();
    }

    Map<String, Float> allFields = extractAllFields(assetConfig);
    return OpenSearchQueryBuilder.queryStringQuery(
        query,
        allFields,
        os.org.opensearch.client.opensearch._types.query_dsl.Operator.And,
        "1",
        50,
        3,
        0.5,
        os.org.opensearch.client.opensearch._types.query_dsl.TextQueryType.MostFields);
  }

  private os.org.opensearch.client.opensearch._types.query_dsl.Query applyFunctionScoringV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query baseQuery,
      AssetTypeConfiguration assetConfig) {
    return baseQuery;
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

  private OpenSearchRequestBuilder createSearchRequestBuilderV2(
      os.org.opensearch.client.opensearch._types.query_dsl.Query query, int from, int size) {
    int maxHits = searchSettings.getGlobalSettings().getMaxResultHits();
    OpenSearchRequestBuilder builder = new OpenSearchRequestBuilder();
    builder.query(query);
    builder.from(Math.min(from, maxHits));
    builder.size(Math.min(size, maxHits));
    return builder;
  }

  private void addConfiguredAggregationsV2(
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
}
