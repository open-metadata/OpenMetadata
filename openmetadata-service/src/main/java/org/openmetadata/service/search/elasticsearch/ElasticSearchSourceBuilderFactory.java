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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.service.search.SearchSourceBuilderFactory;
import org.openmetadata.service.search.indexes.*;

public class ElasticSearchSourceBuilderFactory
    implements SearchSourceBuilderFactory<
        SearchSourceBuilder, QueryBuilder, HighlightBuilder, FunctionScoreQueryBuilder> {

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
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(SearchIndex.getAllFields())
            .fuzziness(Fuzziness.AUTO)
            .fuzzyMaxExpansions(10);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
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
    AssetTypeConfiguration assetConfig = findAssetTypeConfig(indexName, searchSettings);
    Map<String, Float> fuzzyFields;
    Map<String, Float> nonFuzzyFields;

    if (assetConfig.getSearchFields() != null && !assetConfig.getSearchFields().isEmpty()) {
      fuzzyFields =
          assetConfig.getSearchFields().stream()
              .filter(fieldBoost -> isFuzzyField(fieldBoost.getField()))
              .collect(Collectors.toMap(FieldBoost::getField, fb -> fb.getBoost().floatValue()));
      nonFuzzyFields =
          assetConfig.getSearchFields().stream()
              .filter(fieldBoost -> isNonFuzzyField(fieldBoost.getField()))
              .collect(Collectors.toMap(FieldBoost::getField, fb -> fb.getBoost().floatValue()));
    } else {
      Map<String, Float> defaultFields = SearchIndex.getDefaultFields();
      fuzzyFields =
          defaultFields.entrySet().stream()
              .filter(entry -> isFuzzyField(entry.getKey()))
              .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
      nonFuzzyFields =
          defaultFields.entrySet().stream()
              .filter(entry -> isNonFuzzyField(entry.getKey()))
              .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    BoolQueryBuilder baseQuery = QueryBuilders.boolQuery();
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      baseQuery.must(QueryBuilders.matchAllQuery());
    } else if (containsQuerySyntax(query)) {
      QueryStringQueryBuilder fuzzyQueryBuilder =
          QueryBuilders.queryStringQuery(query)
              .fields(fuzzyFields)
              .defaultOperator(Operator.AND)
              .type(MOST_FIELDS)
              .fuzziness(Fuzziness.AUTO)
              .fuzzyMaxExpansions(10)
              .fuzzyPrefixLength(1)
              .tieBreaker(0.3f);

      MultiMatchQueryBuilder nonFuzzyQueryBuilder =
          QueryBuilders.multiMatchQuery(query)
              .fields(nonFuzzyFields)
              .type(MOST_FIELDS)
              .operator(Operator.AND)
              .tieBreaker(0.3f)
              .fuzziness(Fuzziness.ZERO);

      BoolQueryBuilder combinedQuery =
          QueryBuilders.boolQuery()
              .should(fuzzyQueryBuilder)
              .should(nonFuzzyQueryBuilder)
              .minimumShouldMatch(1);

      baseQuery.must(combinedQuery);
    } else {
      BoolQueryBuilder combinedQuery = QueryBuilders.boolQuery();

      if (!fuzzyFields.isEmpty()) {
        MultiMatchQueryBuilder fuzzyQueryBuilder =
            QueryBuilders.multiMatchQuery(query)
                .type(MOST_FIELDS)
                .fuzziness(Fuzziness.AUTO)
                .maxExpansions(10)
                .prefixLength(1)
                .operator(Operator.AND)
                .tieBreaker(0.3f);
        fuzzyFields.forEach(fuzzyQueryBuilder::field);
        combinedQuery.should(fuzzyQueryBuilder);
      }

      if (!nonFuzzyFields.isEmpty()) {
        MultiMatchQueryBuilder nonFuzzyQueryBuilder =
            QueryBuilders.multiMatchQuery(query)
                .type(MOST_FIELDS)
                .operator(Operator.AND)
                .tieBreaker(0.3f)
                .fuzziness(Fuzziness.ZERO);
        nonFuzzyFields.forEach(nonFuzzyQueryBuilder::field);
        combinedQuery.should(nonFuzzyQueryBuilder);
      }

      combinedQuery.minimumShouldMatch(1);
      baseQuery.must(combinedQuery);
    }

    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();
    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      for (TermBoost tb : searchSettings.getGlobalSettings().getTermBoosts()) {
        functions.add(buildTermBoostFunction(tb));
      }
    }
    if (assetConfig.getTermBoosts() != null) {
      for (TermBoost tb : assetConfig.getTermBoosts()) {
        functions.add(buildTermBoostFunction(tb));
      }
    }
    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      for (FieldValueBoost fvb : searchSettings.getGlobalSettings().getFieldValueBoosts()) {
        functions.add(buildFieldValueBoostFunction(fvb));
      }
    }
    if (assetConfig.getFieldValueBoosts() != null) {
      for (FieldValueBoost fvb : assetConfig.getFieldValueBoosts()) {
        functions.add(buildFieldValueBoostFunction(fvb));
      }
    }

    QueryBuilder finalQuery = baseQuery;
    if (!functions.isEmpty()) {
      float functionBoostFactor = 0.3f;
      FunctionScoreQueryBuilder functionScore =
          QueryBuilders.functionScoreQuery(
              baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));

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
      functionScore.boost(functionBoostFactor);
      finalQuery = functionScore;
    }

    HighlightBuilder highlightBuilder = null;
    if (query != null && !query.trim().isEmpty()) {
      if (assetConfig.getHighlightFields() != null && !assetConfig.getHighlightFields().isEmpty()) {
        highlightBuilder = buildHighlights(assetConfig.getHighlightFields());
      } else if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
        highlightBuilder = buildHighlights(searchSettings.getGlobalSettings().getHighlightFields());
      }
    }

    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder()
            .query(finalQuery)
            .from(Math.min(from, searchSettings.getGlobalSettings().getMaxResultHits()))
            .size(Math.min(size, searchSettings.getGlobalSettings().getMaxResultHits()));

    if (highlightBuilder != null) {
      searchSourceBuilder.highlighter(highlightBuilder);
    }

    addConfiguredAggregations(searchSourceBuilder, assetConfig);
    searchSourceBuilder.explain(explain);
    return searchSourceBuilder;
  }

  private FunctionScoreQueryBuilder.FilterFunctionBuilder buildTermBoostFunction(TermBoost tb) {
    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(
        QueryBuilders.termQuery(tb.getField(), tb.getValue()),
        ScoreFunctionBuilders.weightFactorFunction(tb.getBoost().floatValue()));
  }

  private FunctionScoreQueryBuilder.FilterFunctionBuilder buildFieldValueBoostFunction(
      FieldValueBoost fvb) {
    QueryBuilder condition = QueryBuilders.matchAllQuery();
    if (fvb.getCondition() != null && fvb.getCondition().getRange() != null) {
      BoolQueryBuilder rangeQuery = QueryBuilders.boolQuery();
      if (fvb.getCondition().getRange().getGt() != null) {
        rangeQuery.filter(
            QueryBuilders.rangeQuery(fvb.getField()).gt(fvb.getCondition().getRange().getGt()));
      }
      if (fvb.getCondition().getRange().getGte() != null) {
        rangeQuery.filter(
            QueryBuilders.rangeQuery(fvb.getField()).gte(fvb.getCondition().getRange().getGte()));
      }
      if (fvb.getCondition().getRange().getLt() != null) {
        rangeQuery.filter(
            QueryBuilders.rangeQuery(fvb.getField()).lt(fvb.getCondition().getRange().getLt()));
      }
      if (fvb.getCondition().getRange().getLte() != null) {
        rangeQuery.filter(
            QueryBuilders.rangeQuery(fvb.getField()).lte(fvb.getCondition().getRange().getLte()));
      }
      condition = rangeQuery;
    }

    FieldValueFactorFunctionBuilder factorBuilder =
        ScoreFunctionBuilders.fieldValueFactorFunction(fvb.getField())
            .factor(fvb.getFactor().floatValue())
            .missing(fvb.getMissing() == null ? 0.0f : fvb.getMissing().floatValue());

    if (fvb.getModifier() != null) {
      switch (fvb.getModifier().value()) {
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
          }
          break;
        default:
          break;
      }
    }
    return new FunctionScoreQueryBuilder.FilterFunctionBuilder(condition, factorBuilder);
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
    QueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, getAllSearchFieldsFromSettings(searchSettings));

    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();

    // Add global term boosts
    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      for (TermBoost tb : searchSettings.getGlobalSettings().getTermBoosts()) {
        functions.add(buildTermBoostFunction(tb));
      }
    }

    // Add global field value boosts
    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      for (FieldValueBoost fvb : searchSettings.getGlobalSettings().getFieldValueBoosts()) {
        functions.add(buildFieldValueBoostFunction(fvb));
      }
    }

    QueryBuilder finalQuery = queryStringBuilder;
    if (!functions.isEmpty()) {
      FunctionScoreQueryBuilder functionScore =
          QueryBuilders.functionScoreQuery(
              queryStringBuilder,
              functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));
      functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
      functionScore.boostMode(CombineFunction.MULTIPLY);
      finalQuery = functionScore;
    }

    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder()
            .query(finalQuery)
            .from(Math.min(from, searchSettings.getGlobalSettings().getMaxResultHits()))
            .size(Math.min(size, searchSettings.getGlobalSettings().getMaxResultHits()));

    // Add global highlight fields if configured
    if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      searchSourceBuilder.highlighter(
          buildHighlights(searchSettings.getGlobalSettings().getHighlightFields()));
    }

    // Add specific data asset aggregations
    addAggregation(searchSourceBuilder);

    return searchSourceBuilder;
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
}
