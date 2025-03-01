package org.openmetadata.service.search.elasticsearch;

import static es.org.elasticsearch.index.query.QueryBuilders.*;
import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_COLUMN_NAMES;

import es.org.elasticsearch.common.lucene.search.function.CombineFunction;
import es.org.elasticsearch.common.lucene.search.function.FieldValueFactorFunction;
import es.org.elasticsearch.common.lucene.search.function.FunctionScoreQuery;
import es.org.elasticsearch.common.unit.Fuzziness;
import es.org.elasticsearch.index.query.MultiMatchQueryBuilder;
import es.org.elasticsearch.index.query.Operator;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.index.query.QueryStringQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.ScoreFunctionBuilders;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchSourceBuilderFactory;
import org.openmetadata.service.search.indexes.*;

public class ElasticSearchSourceBuilderFactory
    implements SearchSourceBuilderFactory<
        SearchSourceBuilder, QueryBuilder, HighlightBuilder, FunctionScoreQueryBuilder> {

  private static final String FIELD_DISPLAY_NAME = "displayName";
  private static final String FIELD_DESCRIPTION = "description";
  private static final String FIELD_DISPLAY_NAME_NGRAM = "displayName.ngram";
  private static final String UNIFIED = "unified";

  @Override
  public SearchSourceBuilder getSearchSourceBuilder(String index, String q, int from, int size) {
    return switch (Entity.getSearchRepository().getIndexNameWithoutAlias(index)) {
      case "topic_search_index", "topic" -> buildTopicSearchBuilder(q, from, size);
      case "dashboard_search_index", "dashboard" -> buildDashboardSearchBuilder(q, from, size);
      case "pipeline_search_index", "pipeline" -> buildPipelineSearchBuilder(q, from, size);
      case "mlmodel_search_index", "mlmodel" -> buildMlModelSearchBuilder(q, from, size);
      case "table_search_index", "table" -> buildTableSearchBuilder(q, from, size);
      case "database_schema_search_index",
          "databaseSchema",
          "database_search_index",
          "database" -> buildGenericDataAssetSearchBuilder(q, from, size);
      case "user_search_index", "user", "team_search_index", "team" -> buildUserOrTeamSearchBuilder(
          q, from, size);
      case "glossary_term_search_index", "glossaryTerm" -> buildGlossaryTermSearchBuilder(
          q, from, size);
      case "tag_search_index", "tag" -> buildTagSearchBuilder(q, from, size);
      case "container_search_index", "container" -> buildContainerSearchBuilder(q, from, size);
      case "query_search_index", "query" -> buildQuerySearchBuilder(q, from, size);
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearch(q, from, size);
      case "stored_procedure_search_index", "storedProcedure" -> buildStoredProcedureSearch(
          q, from, size);
      case "dashboard_data_model_search_index",
          "dashboardDataModel" -> buildDashboardDataModelsSearch(q, from, size);
      case "domain_search_index", "domain" -> buildDomainsSearch(q, from, size);
      case "search_entity_search_index", "searchIndex" -> buildSearchEntitySearch(q, from, size);
      case "raw_cost_analysis_report_data_index",
          "aggregated_cost_analysis_report_data_index" -> buildCostAnalysisReportDataSearch(
          q, from, size);
      case "data_product_search_index" -> buildDataProductSearch(q, from, size);
      case "test_case_resolution_status_search_index" -> buildTestCaseResolutionStatusSearch(
          q, from, size);
      case "test_case_result_search_index" -> buildTestCaseResultSearch(q, from, size);
      case "api_endpoint_search_index", "apiEndpoint" -> buildApiEndpointSearch(q, from, size);
      case "api_service_search_index",
          "mlmodel_service_search_index",
          "database_service_search_index",
          "messaging_service_index",
          "dashboard_service_index",
          "pipeline_service_index",
          "storage_service_index",
          "search_service_index",
          "metadata_service_index" -> buildServiceSearchBuilder(q, from, size);
      case "dataAsset" -> buildDataAssetsSearchBuilder(q, from, size);
      case "all" -> buildSearchAcrossIndexesBuilder(q, from, size);
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
    if (query instanceof QueryStringQueryBuilder) {
      FunctionScoreQueryBuilder functionScoreQueryBuilder = boostScore(query);
      builder.query(functionScoreQueryBuilder);
    } else {
      builder.query(query);
    }
    if (highlightBuilder != null) {
      builder.highlighter(highlightBuilder);
    }
    builder.from(from);
    builder.size(size);
    return builder;
  }

  @Override
  public FunctionScoreQueryBuilder boostScore(QueryBuilder query) {
    if (!(query instanceof QueryStringQueryBuilder)) {
      throw new IllegalArgumentException("Expected QueryStringQueryBuilder");
    }

    FunctionScoreQueryBuilder.FilterFunctionBuilder tier1Boost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.termQuery("tier.tagFQN", "Tier1"),
            ScoreFunctionBuilders.weightFactorFunction(50.0f));

    FunctionScoreQueryBuilder.FilterFunctionBuilder tier2Boost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.termQuery("tier.tagFQN", "Tier2"),
            ScoreFunctionBuilders.weightFactorFunction(30.0f));

    FunctionScoreQueryBuilder.FilterFunctionBuilder tier3Boost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.termQuery("tier.tagFQN", "Tier3"),
            ScoreFunctionBuilders.weightFactorFunction(15.0f));

    FunctionScoreQueryBuilder.FilterFunctionBuilder weeklyStatsBoost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.rangeQuery("usageSummary.weeklyStats.count").gt(0),
            ScoreFunctionBuilders.fieldValueFactorFunction("usageSummary.weeklyStats.count")
                .factor(4.0f)
                .modifier(FieldValueFactorFunction.Modifier.SQRT)
                .missing(1));

    FunctionScoreQueryBuilder.FilterFunctionBuilder totalVotesBoost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.rangeQuery("totalVotes").gt(0),
            ScoreFunctionBuilders.fieldValueFactorFunction("totalVotes")
                .factor(3.0f)
                .modifier(FieldValueFactorFunction.Modifier.LN1P)
                .missing(0));

    return QueryBuilders.functionScoreQuery(
            query,
            new FunctionScoreQueryBuilder.FilterFunctionBuilder[] {
              tier1Boost, tier2Boost, tier3Boost, weeklyStatsBoost, totalVotesBoost
            })
        .scoreMode(FunctionScoreQuery.ScoreMode.SUM)
        .boostMode(CombineFunction.MULTIPLY);
  }

  @Override
  public HighlightBuilder buildHighlights(List<String> fields) {
    List<String> defaultFields =
        List.of(FIELD_DISPLAY_NAME, FIELD_DESCRIPTION, FIELD_DISPLAY_NAME_NGRAM);
    defaultFields = Stream.concat(defaultFields.stream(), fields.stream()).toList();
    HighlightBuilder hb = new HighlightBuilder();
    for (String field : defaultFields) {
      HighlightBuilder.Field highlightField = new HighlightBuilder.Field(field);
      highlightField.highlighterType(UNIFIED);
      hb.field(highlightField);
    }
    return hb;
  }

  private SearchSourceBuilder buildPipelineSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "tasks.displayName", 5.0f,
                    "tasks.displayName.ngram", 1.0f,
                    "tasks.name", 5.0f,
                    "tasks.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("tasks.name", "tasks.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("tasks.displayName.keyword").field("tasks.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildMlModelSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "algorithm", 5.0f,
                    "algorithm.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("algorithm"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("algorithm").field("algorithm.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TopicIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb =
        buildHighlights(
            List.of(
                "messageSchema.schemaFields.description",
                "messageSchema.schemaFields.children.name"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "charts.name", 5.0f,
                    "charts.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("charts.name"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("charts.name.keyword").field("charts.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "columns.name", 5.0f,
                    "columns.name.ngram", 1.0f,
                    "columns.description", 1.0f,
                    "columns.description.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("columns.name", "columns.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("database.displayName.keyword")
            .field("database.displayName.keyword"));
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("databaseSchema.displayName.keyword")
                .field("databaseSchema.displayName.keyword"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES))
        .aggregation(AggregationBuilders.terms("tableType").field("tableType"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildGenericDataAssetSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildUserOrTeamSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "name", 15.0f,
                    "name.ngram", 1.0f,
                    "email", 15.0f,
                    "email.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("name", "email"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("teams.name").field("teams.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder addAggregation(SearchSourceBuilder searchSourceBuilder) {
    searchSourceBuilder
        .aggregation(AggregationBuilders.terms("serviceType").field("serviceType.keyword"))
        .aggregation(AggregationBuilders.terms("entityType").field("entityType.keyword"))
        .aggregation(
            AggregationBuilders.terms("owner.displayName").field("owner.displayName.keyword"))
        .aggregation(AggregationBuilders.terms("owner.type").field("owner.type.keyword"))
        .aggregation(AggregationBuilders.terms("service.name").field("service.name.keyword"))
        .aggregation(AggregationBuilders.terms("service.type").field("service.type.keyword"))
        .aggregation(AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN.keyword"))
        .aggregation(AggregationBuilders.terms("tags.tagFQN").field("tags.tagFQN.keyword"))
        .aggregation(AggregationBuilders.terms("database.name").field("database.name.keyword"))
        .aggregation(
            AggregationBuilders.terms("databaseSchema.name").field("databaseSchema.name.keyword"))
        .aggregation(AggregationBuilders.terms("domain.name").field("domain.name.keyword"));
    return searchSourceBuilder;
  }

  private SearchSourceBuilder buildGlossaryTermSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "synonyms", 10.0f,
                    "synonyms.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("synonyms"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("glossary.name").field("glossary.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTagSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "classification.name", 10.0f,
                    "classification.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("classification.name"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("classification.name").field("classification.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildContainerSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "dataModel.columns.name", 10.0f,
                    "dataModel.columns.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("dataModel.columns.name"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildQuerySearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "query", 10.0f,
                    "query.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("query"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("users.name").field("users.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "entityLink", 10.0f,
                    "testSuite.name", 10.0f,
                    "testSuite.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("testSuite.name"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildStoredProcedureSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildDashboardDataModelsSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "columns.name", 10.0f,
                    "columns.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("columns.name"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildDomainsSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildSearchEntitySearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "fields.name", 10.0f,
                    "fields.name.ngram", 1.0f,
                    "fields.description", 1.0f,
                    "fields.description.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("fields.name", "fields.description"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildCostAnalysisReportDataSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildDataProductSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "assets.name", 10.0f,
                    "assets.name.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("assets.name"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildTestCaseResolutionStatusSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "testCaseReference", 10.0f,
                    "testCaseReference.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("testCaseReference"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildTestCaseResultSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildApiEndpointSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "path", 10.0f,
                    "path.ngram", 1.0f));
    HighlightBuilder hb = buildHighlights(List.of("path"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private SearchSourceBuilder buildServiceSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildDataAssetsSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildSearchAcrossIndexesBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "entityType", 10.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }

  private SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        (QueryStringQueryBuilder)
            buildSearchQueryBuilder(
                query,
                Map.of(
                    "displayName", 15.0f,
                    "displayName.ngram", 1.0f,
                    "description", 1.0f,
                    "description.ngram", 1.0f,
                    "fullyQualifiedName", 10.0f,
                    "fullyQualifiedName.ngram", 1.0f,
                    "entityType", 10.0f));
    return searchBuilder(queryBuilder, buildHighlights(List.of()), from, size);
  }
}
