package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static os.org.opensearch.index.query.MultiMatchQueryBuilder.Type.MOST_FIELDS;

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
import org.openmetadata.service.search.SearchSourceBuilderFactory;
import org.openmetadata.service.search.indexes.*;
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
import os.org.opensearch.search.builder.SearchSourceBuilder;
import os.org.opensearch.search.fetch.subphase.highlight.HighlightBuilder;

public class OpenSearchSourceBuilderFactory
    implements SearchSourceBuilderFactory<
        SearchSourceBuilder, QueryBuilder, HighlightBuilder, FunctionScoreQueryBuilder> {

  private final SearchSettings searchSettings;

  public OpenSearchSourceBuilderFactory(SearchSettings searchSettings) {
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
    // Use a composite configuration that includes all asset types
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);

    // Build the query using the same logic as buildDataAssetSearchBuilder
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, compositeConfig);

    // Apply function scoring for term boosts and field value boosts
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();
    if (searchSettings.getGlobalSettings().getTermBoosts() != null) {
      for (TermBoost tb : searchSettings.getGlobalSettings().getTermBoosts()) {
        functions.add(buildTermBoostFunction(tb));
      }
    }
    if (compositeConfig.getTermBoosts() != null) {
      for (TermBoost tb : compositeConfig.getTermBoosts()) {
        functions.add(buildTermBoostFunction(tb));
      }
    }
    if (searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      for (FieldValueBoost fvb : searchSettings.getGlobalSettings().getFieldValueBoosts()) {
        functions.add(buildFieldValueBoostFunction(fvb));
      }
    }
    if (compositeConfig.getFieldValueBoosts() != null) {
      for (FieldValueBoost fvb : compositeConfig.getFieldValueBoosts()) {
        functions.add(buildFieldValueBoostFunction(fvb));
      }
    }

    QueryBuilder finalQuery = baseQuery;
    if (!functions.isEmpty()) {
      float functionBoostFactor = 0.3f;
      FunctionScoreQueryBuilder functionScore =
          QueryBuilders.functionScoreQuery(
              baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));

      if (compositeConfig.getScoreMode() != null) {
        functionScore.scoreMode(toScoreMode(compositeConfig.getScoreMode().value()));
      } else {
        functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
      }

      if (compositeConfig.getBoostMode() != null) {
        functionScore.boostMode(toCombineFunction(compositeConfig.getBoostMode().value()));
      } else {
        functionScore.boostMode(CombineFunction.SUM);
      }

      functionScore.boost(functionBoostFactor);
      finalQuery = functionScore;
    }

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
    AssetTypeConfiguration assetConfig = findAssetTypeConfig(indexName, searchSettings);

    BoolQueryBuilder baseQuery = QueryBuilders.boolQuery();
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      baseQuery.must(QueryBuilders.matchAllQuery());
    } else if (containsQuerySyntax(query)) {
      // Extract fields from assetConfig for complex query syntax
      Map<String, Float> allFields = new HashMap<>();
      Map<String, Float> fuzzyFields = new HashMap<>();
      Map<String, Float> nonFuzzyFields = new HashMap<>();

      if (assetConfig.getSearchFields() != null) {
        for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
          String field = fieldBoost.getField();
          float boost = fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : 1.0f;
          allFields.put(field, boost);

          // Classify fields as fuzzy or non-fuzzy
          if (isFuzzyField(field)) {
            fuzzyFields.put(field, boost);
          }
          if (isNonFuzzyField(field)) {
            nonFuzzyFields.put(field, boost);
          }
        }
      }

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

      // Get boost multipliers from configuration
      float exactMatchMultiplier = 2.0f;
      float phraseMatchMultiplier = 1.5f;
      float fuzzyMatchMultiplier = 1.0f;

      if (assetConfig.getMatchTypeBoostMultipliers() != null) {
        if (assetConfig.getMatchTypeBoostMultipliers().getExactMatchMultiplier() != null) {
          exactMatchMultiplier =
              assetConfig.getMatchTypeBoostMultipliers().getExactMatchMultiplier().floatValue();
        }
        if (assetConfig.getMatchTypeBoostMultipliers().getPhraseMatchMultiplier() != null) {
          phraseMatchMultiplier =
              assetConfig.getMatchTypeBoostMultipliers().getPhraseMatchMultiplier().floatValue();
        }
        if (assetConfig.getMatchTypeBoostMultipliers().getFuzzyMatchMultiplier() != null) {
          fuzzyMatchMultiplier =
              assetConfig.getMatchTypeBoostMultipliers().getFuzzyMatchMultiplier().floatValue();
        }
      }

      // Group fields by match type
      Map<String, Float> exactMatchFields = new HashMap<>();
      Map<String, Float> phraseMatchFields = new HashMap<>();
      Map<String, Float> fuzzyMatchFields = new HashMap<>();
      Map<String, Float> standardMatchFields = new HashMap<>();

      if (assetConfig.getSearchFields() != null) {
        for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
          String matchType =
              fieldBoost.getMatchType() != null ? fieldBoost.getMatchType().value() : "standard";
          float boost = fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : 1.0f;

          switch (matchType) {
            case "exact":
              exactMatchFields.put(fieldBoost.getField(), boost);
              break;
            case "phrase":
              phraseMatchFields.put(fieldBoost.getField(), boost);
              break;
            case "fuzzy":
              fuzzyMatchFields.put(fieldBoost.getField(), boost);
              break;
            case "standard":
            default:
              standardMatchFields.put(fieldBoost.getField(), boost);
              break;
          }
        }
      }

      // Add exact match queries
      if (!exactMatchFields.isEmpty()) {
        BoolQueryBuilder exactMatchQuery = QueryBuilders.boolQuery();
        exactMatchFields.forEach(
            (field, boost) -> {
              exactMatchQuery.should(
                  QueryBuilders.termQuery(field, query.toLowerCase()).boost(boost));
            });
        if (exactMatchQuery.hasClauses()) {
          combinedQuery.should(exactMatchQuery.boost(exactMatchMultiplier));
        }
      }

      // Add phrase match queries
      if (!phraseMatchFields.isEmpty()) {
        BoolQueryBuilder phraseMatchQuery = QueryBuilders.boolQuery();
        phraseMatchFields.forEach(
            (field, boost) -> {
              phraseMatchQuery.should(QueryBuilders.matchPhraseQuery(field, query).boost(boost));
            });
        if (phraseMatchQuery.hasClauses()) {
          combinedQuery.should(phraseMatchQuery.boost(phraseMatchMultiplier));
        }
      }

      // Add fuzzy match queries
      if (!fuzzyMatchFields.isEmpty()) {
        MultiMatchQueryBuilder fuzzyQueryBuilder =
            QueryBuilders.multiMatchQuery(query)
                .type(MOST_FIELDS)
                .fuzziness(Fuzziness.AUTO)
                .maxExpansions(10)
                .prefixLength(1)
                .operator(Operator.AND)
                .tieBreaker(0.3f);
        fuzzyMatchFields.forEach(fuzzyQueryBuilder::field);
        combinedQuery.should(fuzzyQueryBuilder.boost(fuzzyMatchMultiplier));
      }

      // Add standard match queries (combination of existing fuzzy and non-fuzzy logic)
      if (!standardMatchFields.isEmpty()) {
        Map<String, Float> standardFuzzyFields =
            standardMatchFields.entrySet().stream()
                .filter(entry -> isFuzzyField(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        Map<String, Float> standardNonFuzzyFields =
            standardMatchFields.entrySet().stream()
                .filter(entry -> isNonFuzzyField(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        if (!standardFuzzyFields.isEmpty()) {
          MultiMatchQueryBuilder fuzzyQueryBuilder =
              QueryBuilders.multiMatchQuery(query)
                  .type(MOST_FIELDS)
                  .fuzziness(Fuzziness.AUTO)
                  .maxExpansions(10)
                  .prefixLength(1)
                  .operator(Operator.OR)
                  .minimumShouldMatch("2<70%")
                  .tieBreaker(0.3f);
          standardFuzzyFields.forEach(fuzzyQueryBuilder::field);
          combinedQuery.should(fuzzyQueryBuilder);
        }

        if (!standardNonFuzzyFields.isEmpty()) {
          MultiMatchQueryBuilder nonFuzzyQueryBuilder =
              QueryBuilders.multiMatchQuery(query)
                  .type(MOST_FIELDS)
                  .operator(Operator.AND)
                  .tieBreaker(0.3f)
                  .fuzziness(Fuzziness.ZERO);
          standardNonFuzzyFields.forEach(nonFuzzyQueryBuilder::field);
          combinedQuery.should(nonFuzzyQueryBuilder);
        }
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
  public SearchSourceBuilder buildCommonSearchBuilder(String query, int from, int size) {
    // Create a composite configuration that includes all asset types
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);

    // Build the query using matchType support
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, compositeConfig);

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

    QueryBuilder finalQuery = baseQuery;
    if (!functions.isEmpty()) {
      FunctionScoreQueryBuilder functionScore =
          QueryBuilders.functionScoreQuery(
              baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));
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

    addAggregation(searchSourceBuilder);
    return searchSourceBuilder;
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
    // Instead of building separate queries for each entity type,
    // use a composite configuration but apply entity-type specific boosts

    // Build composite configuration from all asset types
    AssetTypeConfiguration compositeConfig = buildCompositeAssetConfig(searchSettings);

    // Build the base query using the composite configuration
    QueryBuilder baseQuery = buildQueryWithMatchTypes(query, compositeConfig);

    // Apply global function scoring
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

    // Add entity-type specific boosts as function score queries
    // This provides entity-specific scoring without creating separate queries
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
      AssetTypeConfiguration assetConfig =
          searchSettings.getAssetTypeConfigurations().stream()
              .filter(config -> config.getAssetType().equals(assetType))
              .findFirst()
              .orElse(null);

      if (assetConfig != null) {
        // Add entity-specific term boosts with entity type filter
        if (assetConfig.getTermBoosts() != null) {
          for (TermBoost tb : assetConfig.getTermBoosts()) {
            functions.add(
                new FunctionScoreQueryBuilder.FilterFunctionBuilder(
                    QueryBuilders.boolQuery()
                        .must(QueryBuilders.termQuery("entityType", assetType))
                        .must(QueryBuilders.termQuery(tb.getField(), tb.getValue())),
                    ScoreFunctionBuilders.weightFactorFunction(tb.getBoost().floatValue())));
          }
        }

        // Add entity-specific field value boosts with entity type filter
        if (assetConfig.getFieldValueBoosts() != null) {
          for (FieldValueBoost fvb : assetConfig.getFieldValueBoosts()) {
            QueryBuilder condition =
                QueryBuilders.boolQuery().must(QueryBuilders.termQuery("entityType", assetType));

            if (fvb.getCondition() != null && fvb.getCondition().getRange() != null) {
              BoolQueryBuilder rangeQuery = QueryBuilders.boolQuery();
              if (fvb.getCondition().getRange().getGt() != null) {
                rangeQuery.filter(
                    QueryBuilders.rangeQuery(fvb.getField())
                        .gt(fvb.getCondition().getRange().getGt()));
              }
              if (fvb.getCondition().getRange().getGte() != null) {
                rangeQuery.filter(
                    QueryBuilders.rangeQuery(fvb.getField())
                        .gte(fvb.getCondition().getRange().getGte()));
              }
              if (fvb.getCondition().getRange().getLt() != null) {
                rangeQuery.filter(
                    QueryBuilders.rangeQuery(fvb.getField())
                        .lt(fvb.getCondition().getRange().getLt()));
              }
              if (fvb.getCondition().getRange().getLte() != null) {
                rangeQuery.filter(
                    QueryBuilders.rangeQuery(fvb.getField())
                        .lte(fvb.getCondition().getRange().getLte()));
              }
              ((BoolQueryBuilder) condition).must(rangeQuery);
            }

            functions.add(
                new FunctionScoreQueryBuilder.FilterFunctionBuilder(
                    condition, buildFieldValueBoostFunction(fvb).getScoreFunction()));
          }
        }
      }
    }

    QueryBuilder finalQuery = baseQuery;
    if (!functions.isEmpty()) {
      float functionBoostFactor = 0.3f;
      FunctionScoreQueryBuilder functionScore =
          QueryBuilders.functionScoreQuery(
              baseQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));

      functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
      functionScore.boostMode(CombineFunction.SUM);
      functionScore.boost(functionBoostFactor);
      finalQuery = functionScore;
    }

    SearchSourceBuilder searchSourceBuilder = searchBuilder(finalQuery, null, from, size);
    return addAggregation(searchSourceBuilder);
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
    BoolQueryBuilder baseQuery = QueryBuilders.boolQuery();
    if (query == null || query.trim().isEmpty() || query.trim().equals("*")) {
      baseQuery.must(QueryBuilders.matchAllQuery());
      return baseQuery;
    }

    // Check if query contains complex syntax like wildcards, AND/OR, field queries, etc.
    if (containsQuerySyntax(query)) {
      // Use QueryStringQueryBuilder for complex queries to support wildcards and boolean operators
      Map<String, Float> allFields = new HashMap<>();
      if (assetConfig.getSearchFields() != null) {
        for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
          float boost = fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : 1.0f;
          allFields.put(fieldBoost.getField(), boost);
        }
      }

      // Use query string for complex syntax support
      QueryStringQueryBuilder queryStringBuilder =
          QueryBuilders.queryStringQuery(query)
              .fields(allFields)
              .type(MOST_FIELDS)
              .defaultOperator(Operator.AND)
              .analyzeWildcard(true)
              .allowLeadingWildcard(true)
              .fuzzyMaxExpansions(50)
              .tieBreaker(0.5f);

      baseQuery.must(queryStringBuilder);
      return baseQuery;
    }

    BoolQueryBuilder combinedQuery = QueryBuilders.boolQuery();

    // Get boost multipliers from configuration
    float exactMatchMultiplier = 2.0f;
    float phraseMatchMultiplier = 1.5f;
    float fuzzyMatchMultiplier = 1.0f;

    if (assetConfig.getMatchTypeBoostMultipliers() != null) {
      if (assetConfig.getMatchTypeBoostMultipliers().getExactMatchMultiplier() != null) {
        exactMatchMultiplier =
            assetConfig.getMatchTypeBoostMultipliers().getExactMatchMultiplier().floatValue();
      }
      if (assetConfig.getMatchTypeBoostMultipliers().getPhraseMatchMultiplier() != null) {
        phraseMatchMultiplier =
            assetConfig.getMatchTypeBoostMultipliers().getPhraseMatchMultiplier().floatValue();
      }
      if (assetConfig.getMatchTypeBoostMultipliers().getFuzzyMatchMultiplier() != null) {
        fuzzyMatchMultiplier =
            assetConfig.getMatchTypeBoostMultipliers().getFuzzyMatchMultiplier().floatValue();
      }
    }

    // Group fields by match type
    Map<String, Float> exactMatchFields = new HashMap<>();
    Map<String, Float> phraseMatchFields = new HashMap<>();
    Map<String, Float> fuzzyMatchFields = new HashMap<>();
    Map<String, Float> standardMatchFields = new HashMap<>();

    if (assetConfig.getSearchFields() != null) {
      for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
        String matchType =
            fieldBoost.getMatchType() != null ? fieldBoost.getMatchType().value() : "standard";
        float boost = fieldBoost.getBoost() != null ? fieldBoost.getBoost().floatValue() : 1.0f;

        switch (matchType) {
          case "exact":
            exactMatchFields.put(fieldBoost.getField(), boost);
            break;
          case "phrase":
            phraseMatchFields.put(fieldBoost.getField(), boost);
            break;
          case "fuzzy":
            fuzzyMatchFields.put(fieldBoost.getField(), boost);
            break;
          case "standard":
          default:
            standardMatchFields.put(fieldBoost.getField(), boost);
            break;
        }
      }
    }

    // Add exact match queries
    if (!exactMatchFields.isEmpty()) {
      BoolQueryBuilder exactMatchQuery = QueryBuilders.boolQuery();
      exactMatchFields.forEach(
          (field, boost) -> {
            exactMatchQuery.should(
                QueryBuilders.termQuery(field, query.toLowerCase()).boost(boost));
          });
      if (exactMatchQuery.hasClauses()) {
        combinedQuery.should(exactMatchQuery.boost(exactMatchMultiplier));
      }
    }

    // Add phrase match queries
    if (!phraseMatchFields.isEmpty()) {
      BoolQueryBuilder phraseMatchQuery = QueryBuilders.boolQuery();
      phraseMatchFields.forEach(
          (field, boost) -> {
            phraseMatchQuery.should(QueryBuilders.matchPhraseQuery(field, query).boost(boost));
          });
      if (phraseMatchQuery.hasClauses()) {
        combinedQuery.should(phraseMatchQuery.boost(phraseMatchMultiplier));
      }
    }

    // Add fuzzy match queries
    if (!fuzzyMatchFields.isEmpty()) {
      MultiMatchQueryBuilder fuzzyQueryBuilder =
          QueryBuilders.multiMatchQuery(query)
              .type(MOST_FIELDS)
              .fuzziness(Fuzziness.AUTO)
              .maxExpansions(10)
              .prefixLength(1)
              .operator(Operator.OR)
              .minimumShouldMatch("2<70%")
              .tieBreaker(0.3f);
      fuzzyMatchFields.forEach(fuzzyQueryBuilder::field);
      combinedQuery.should(fuzzyQueryBuilder.boost(fuzzyMatchMultiplier));
    }

    // Add standard match queries
    if (!standardMatchFields.isEmpty()) {
      Map<String, Float> standardFuzzyFields =
          standardMatchFields.entrySet().stream()
              .filter(entry -> isFuzzyField(entry.getKey()))
              .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

      Map<String, Float> standardNonFuzzyFields =
          standardMatchFields.entrySet().stream()
              .filter(entry -> isNonFuzzyField(entry.getKey()))
              .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

      if (!standardFuzzyFields.isEmpty()) {
        MultiMatchQueryBuilder fuzzyQueryBuilder =
            QueryBuilders.multiMatchQuery(query)
                .type(MOST_FIELDS)
                .fuzziness(Fuzziness.AUTO)
                .maxExpansions(10)
                .prefixLength(1)
                .operator(Operator.OR)
                .minimumShouldMatch("2<70%")
                .tieBreaker(0.3f);
        standardFuzzyFields.forEach(fuzzyQueryBuilder::field);
        combinedQuery.should(fuzzyQueryBuilder);
      }

      if (!standardNonFuzzyFields.isEmpty()) {
        MultiMatchQueryBuilder nonFuzzyQueryBuilder =
            QueryBuilders.multiMatchQuery(query)
                .type(MOST_FIELDS)
                .operator(Operator.AND)
                .tieBreaker(0.3f)
                .fuzziness(Fuzziness.ZERO);
        standardNonFuzzyFields.forEach(nonFuzzyQueryBuilder::field);
        combinedQuery.should(nonFuzzyQueryBuilder);
      }
    }

    combinedQuery.minimumShouldMatch(1);
    baseQuery.must(combinedQuery);

    return baseQuery;
  }
}
