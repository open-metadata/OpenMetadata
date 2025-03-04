package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.search.EntityBuilderConstant.DOMAIN_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_TAG_FQN_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_AGGREGATE_SIZE;
import static org.openmetadata.service.search.EntityBuilderConstant.OWNER_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.service.Entity;
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
  public SearchSourceBuilder getSearchSourceBuilder(String index, String q, int from, int size) {
    String indexName = Entity.getSearchRepository().getIndexNameWithoutAlias(index);

    if (isTimeSeriesIndex(indexName)) {
      return buildTimeSeriesSearchBuilder(indexName, q, from, size);
    }

    if (isServiceIndex(indexName)) {
      return buildServiceSearchBuilder(q, from, size);
    }

    if (isDataQualityIndex(indexName)) {
      return buildDataQualitySearchBuilder(indexName, q, from, size);
    }

    if (isDataAssetIndex(indexName)) {
      return buildDataAssetSearchBuilder(indexName, q, from, size);
    }

    if (indexName.equals("all") || indexName.equals("dataAsset")) {
      return buildCommonSearchBuilder(q, from, size);
    }
    return switch (indexName) {
      case "user_search_index", "user", "team_search_index", "team" -> buildUserOrTeamSearchBuilder(
          q, from, size);
      default -> buildAggregateSearchBuilder(q, from, size);
    };
  }

  @Override
  public QueryStringQueryBuilder buildSearchQueryBuilder(String query, Map<String, Float> fields) {
    return QueryBuilders.queryStringQuery(query)
        .fields(fields)
        .type(MultiMatchQueryBuilder.Type.MOST_FIELDS)
        .defaultOperator(Operator.AND)
        .fuzziness(Fuzziness.AUTO)
        .fuzzyPrefixLength(3)
        .tieBreaker(0.5f);
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

  private SearchSourceBuilder buildUserOrTeamSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = buildSearchQueryBuilder(query, UserIndex.getFields());
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder addAggregation(SearchSourceBuilder searchSourceBuilder) {
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("serviceType").field("serviceType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("service.displayName.keyword")
                .field("service.displayName.keyword")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("entityType").field("entityType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("certification.tagLabel.tagFQN")
                .field("certification.tagLabel.tagFQN")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(OWNER_DISPLAY_NAME_KEYWORD)
                .field(OWNER_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(DOMAIN_DISPLAY_NAME_KEYWORD)
                .field(DOMAIN_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms(ES_TAG_FQN_FIELD).field(ES_TAG_FQN_FIELD))
        .aggregation(
            AggregationBuilders.terms("index_count").field("_index").size(MAX_AGGREGATE_SIZE));
    return searchSourceBuilder;
  }

  private SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, TestCaseIndex.getFields());
    HighlightBuilder hb = buildHighlights(List.of("testSuite.name", "testSuite.description"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildCostAnalysisReportDataSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private SearchSourceBuilder buildTestCaseResolutionStatusSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, TestCaseResolutionStatusIndex.getFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildTestCaseResultSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, TestCaseResultIndex.getFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildServiceSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getDefaultFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(SearchIndex.getAllFields())
            .fuzziness(Fuzziness.AUTO);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private boolean isDataAssetIndex(String indexName) {
    return switch (indexName) {
      case "topic_search_index",
          Entity.TOPIC,
          "dashboard_search_index",
          Entity.DASHBOARD,
          "pipeline_search_index",
          Entity.PIPELINE,
          "mlmodel_search_index",
          Entity.MLMODEL,
          "table_search_index",
          Entity.TABLE,
          "database_schema_search_index",
          Entity.DATABASE_SCHEMA,
          "database_search_index",
          Entity.DATABASE,
          "container_search_index",
          Entity.CONTAINER,
          "query_search_index",
          Entity.QUERY,
          "stored_procedure_search_index",
          Entity.STORED_PROCEDURE,
          "dashboard_data_model_search_index",
          Entity.DASHBOARD_DATA_MODEL,
          "data_product_search_index",
          "api_endpoint_search_index",
          Entity.API_ENDPOINT,
          "all",
          "dataAsset" -> true;
      default -> false;
    };
  }

  private SearchSourceBuilder buildDataAssetSearchBuilder(
      String indexName, String query, int from, int size) {
    AssetTypeConfiguration assetConfig = findAssetTypeConfig(indexName);
    boolean useNatLang =
        assetConfig.getUseNaturalLanguageSearch() != null
            ? assetConfig.getUseNaturalLanguageSearch()
            : searchSettings.getGlobalSettings().getUseNaturalLanguageSearch();
    QueryBuilder userQuery;
    if (query == null || query.trim().isEmpty()) {
      userQuery = QueryBuilders.matchAllQuery();
    } else {

      MultiMatchQueryBuilder multiMatchQuery = QueryBuilders.multiMatchQuery(query);

      if (assetConfig.getSearchFields() != null && !assetConfig.getSearchFields().isEmpty()) {
        assetConfig
            .getSearchFields()
            .forEach(
                fieldBoost ->
                    multiMatchQuery.field(
                        fieldBoost.getField(), fieldBoost.getBoost().floatValue()));
      } else {
        multiMatchQuery.fields(SearchIndex.getDefaultFields());
      }

      if (useNatLang) {
        multiMatchQuery
            .type(MultiMatchQueryBuilder.Type.MOST_FIELDS)
            .fuzziness(Fuzziness.AUTO)
            .operator(Operator.OR)
            .tieBreaker(0.5f);
      } else {
        multiMatchQuery.type(MultiMatchQueryBuilder.Type.BEST_FIELDS).operator(Operator.AND);
      }

      userQuery = multiMatchQuery;
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

    QueryBuilder finalQuery = userQuery;
    if (!functions.isEmpty()) {
      FunctionScoreQueryBuilder functionScore =
          QueryBuilders.functionScoreQuery(
              userQuery, functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]));

      if (assetConfig.getScoreMode() != null) {
        functionScore.scoreMode(toScoreMode(assetConfig.getScoreMode().value()));
      } else {
        functionScore.scoreMode(FunctionScoreQuery.ScoreMode.SUM);
      }

      if (assetConfig.getBoostMode() != null) {
        functionScore.boostMode(toCombineFunction(assetConfig.getBoostMode().value()));
      } else {
        functionScore.boostMode(CombineFunction.MULTIPLY);
      }

      finalQuery = functionScore;
    }

    HighlightBuilder highlightBuilder = null;
    if (assetConfig.getHighlightFields() != null && !assetConfig.getHighlightFields().isEmpty()) {
      highlightBuilder = buildHighlights(assetConfig.getHighlightFields());
    } else if (searchSettings.getGlobalSettings().getHighlightFields() != null) {
      highlightBuilder = buildHighlights(searchSettings.getGlobalSettings().getHighlightFields());
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
    if (assetConfig.getAggregations() != null) {
      for (Aggregation agg : assetConfig.getAggregations()) {
        searchSourceBuilder.aggregation(
            AggregationBuilders.terms(agg.getName())
                .field(agg.getField())
                .size(searchSettings.getGlobalSettings().getMaxAggregateSize()));
      }
    }

    if (searchSettings.getGlobalSettings().getAggregations() != null) {
      for (Aggregation agg : searchSettings.getGlobalSettings().getAggregations()) {
        searchSourceBuilder.aggregation(
            AggregationBuilders.terms(agg.getName())
                .field(agg.getField())
                .size(searchSettings.getGlobalSettings().getMaxAggregateSize()));
      }
    }
  }

  private AssetTypeConfiguration findAssetTypeConfig(String indexName) {
    String assetType =
        switch (indexName) {
          case "topic_search_index", Entity.TOPIC -> Entity.TOPIC;
          case "dashboard_search_index", Entity.DASHBOARD -> Entity.DASHBOARD;
          case "pipeline_search_index", Entity.PIPELINE -> Entity.PIPELINE;
          case "mlmodel_search_index", Entity.MLMODEL -> Entity.MLMODEL;
          case "table_search_index", Entity.TABLE -> Entity.TABLE;
          case "database_search_index", Entity.DATABASE -> Entity.DATABASE;
          case "database_schema_search_index", Entity.DATABASE_SCHEMA -> Entity.DATABASE_SCHEMA;
          case "container_search_index", Entity.CONTAINER -> Entity.CONTAINER;
          case "query_search_index", Entity.QUERY -> Entity.QUERY;
          case "stored_procedure_search_index", Entity.STORED_PROCEDURE -> Entity.STORED_PROCEDURE;
          case "dashboard_data_model_search_index", Entity.DASHBOARD_DATA_MODEL -> Entity
              .DASHBOARD_DATA_MODEL;
          case "api_endpoint_search_index", Entity.API_ENDPOINT -> Entity.API_ENDPOINT;
          case "search_entity_search_index", Entity.SEARCH_INDEX -> Entity.SEARCH_INDEX;
          case "tag_search_index", Entity.TAG -> Entity.TAG;
          case "glossary_term_search_index", Entity.GLOSSARY_TERM -> Entity.GLOSSARY_TERM;
          default -> "default";
        };

    return searchSettings.getAssetTypeConfigurations().stream()
        .filter(config -> config.getAssetType().equals(assetType))
        .findFirst()
        .orElse(searchSettings.getDefaultConfiguration());
  }

  private boolean isTimeSeriesIndex(String indexName) {
    return switch (indexName) {
      case "test_case_result_search_index",
          "test_case_resolution_status_search_index",
          "raw_cost_analysis_report_data_index",
          "aggregated_cost_analysis_report_data_index" -> true;
      default -> false;
    };
  }

  private boolean isDataQualityIndex(String indexName) {
    return switch (indexName) {
      case "test_case_search_index", "testCase", "test_suite_search_index", "testSuite" -> true;
      default -> false;
    };
  }

  private boolean isServiceIndex(String indexName) {
    return switch (indexName) {
      case "api_service_search_index",
          "mlmodel_service_search_index",
          "database_service_search_index",
          "messaging_service_index",
          "dashboard_service_index",
          "pipeline_service_index",
          "storage_service_index",
          "search_service_index",
          "metadata_service_index" -> true;
      default -> false;
    };
  }

  private SearchSourceBuilder buildTimeSeriesSearchBuilder(
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

  private SearchSourceBuilder buildDataQualitySearchBuilder(
      String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearch(query, from, size);
      default -> buildAggregateSearchBuilder(query, from, size);
    };
  }

  private Map<String, Float> getAllSearchFieldsFromSettings() {
    Map<String, Float> fields = new HashMap<>();

    for (AssetTypeConfiguration config : searchSettings.getAssetTypeConfigurations()) {
      String assetType = config.getAssetType();
      boolean shouldInclude =
          switch (assetType) {
            case "table",
                "storedProcedure",
                "dashboard",
                "dashboardDataModel",
                "pipeline",
                "topic",
                "mlmodel",
                "container",
                "searchIndex",
                "glossaryTerm",
                "tag",
                "dataProduct",
                "apiEndpoint" -> true;
            default -> false;
          };

      if (shouldInclude && config.getSearchFields() != null) {
        config
            .getSearchFields()
            .forEach(
                fieldBoost ->
                    fields.put(fieldBoost.getField(), fieldBoost.getBoost().floatValue()));
      }
    }

    // Add fields from default configuration
    if (searchSettings.getDefaultConfiguration() != null
        && searchSettings.getDefaultConfiguration().getSearchFields() != null) {
      searchSettings
          .getDefaultConfiguration()
          .getSearchFields()
          .forEach(
              fieldBoost -> fields.put(fieldBoost.getField(), fieldBoost.getBoost().floatValue()));
    }

    return fields;
  }

  private SearchSourceBuilder buildCommonSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, getAllSearchFieldsFromSettings());

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
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("database.name.keyword")
                .field("database.name.keyword")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("databaseSchema.name.keyword")
                .field("databaseSchema.name.keyword")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("database.displayName")
                .field("database.displayName")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("databaseSchema.displayName")
                .field("databaseSchema.displayName")
                .size(MAX_AGGREGATE_SIZE));

    return searchSourceBuilder;
  }
}
