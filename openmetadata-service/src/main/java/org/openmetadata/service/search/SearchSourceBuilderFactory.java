package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchUtil.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtil.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtil.isServiceIndex;
import static org.openmetadata.service.search.SearchUtil.isTimeSeriesIndex;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.Entity;

/**
 * Interface for creating search source builders for different entity types.
 * This interface provides a common contract for both ElasticSearch and OpenSearch implementations.
 *
 * @param <S> The SearchSourceBuilder type (different for ElasticSearch and OpenSearch)
 * @param <Q> The QueryBuilder type
 * @param <H> The HighlightBuilder type
 * @param <F> The FunctionScoreQueryBuilder type
 */
public interface SearchSourceBuilderFactory<S, Q, H, F> {

  Pattern QUERY_SYNTAX_PATTERN =
      Pattern.compile(
          "\\w+\\s*:\\s*\\w+|"
              + // Field queries (field:value)
              "\\b(?i)(?:AND|OR|NOT)\\b|"
              + // Boolean operators
              "[*?]|"
              + // Wildcards
              "[()]|"
              + // Parentheses
              "\"|"
              + // Quotes
              "\\[.+\\s+TO\\s+.+\\]|"
              + // Range queries
              "[+\\-~\\^]" // Special operators
          );

  /**
   * Get the appropriate search source builder based on the index name.
   *
   * @param index the index name
   * @param q the search query
   * @param from the starting offset
   * @param size the number of results to return
   * @return a search source builder configured for the specific entity type
   */
  default S getSearchSourceBuilder(String index, String q, int from, int size) {
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

  S buildServiceSearchBuilder(String query, int from, int size);

  S buildDataAssetSearchBuilder(String indexName, String query, int from, int size);

  S buildCommonSearchBuilder(String query, int from, int size);

  S buildUserOrTeamSearchBuilder(String query, int from, int size);

  S buildAggregateSearchBuilder(String query, int from, int size);

  default S buildTimeSeriesSearchBuilder(String indexName, String query, int from, int size) {
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

  default S buildDataQualitySearchBuilder(String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearch(query, from, size);
      default -> buildAggregateSearchBuilder(query, from, size);
    };
  }

  S buildTestCaseSearch(String query, int from, int size);

  S buildTestCaseResultSearch(String query, int from, int size);

  S buildTestCaseResolutionStatusSearch(String query, int from, int size);

  S buildCostAnalysisReportDataSearch(String query, int from, int size);

  default AssetTypeConfiguration findAssetTypeConfig(
      String indexName, SearchSettings searchSettings) {
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
          case "domain_search_index", Entity.DOMAIN -> Entity.DOMAIN;
          case "data_product_search_index", Entity.DATA_PRODUCT -> Entity.DATA_PRODUCT;
          default -> "default";
        };

    return searchSettings.getAssetTypeConfigurations().stream()
        .filter(config -> config.getAssetType().equals(assetType))
        .findFirst()
        .orElse(searchSettings.getDefaultConfiguration());
  }

  default Map<String, Float> getAllSearchFieldsFromSettings(SearchSettings searchSettings) {
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

  /**
   * Build a search query builder with the specified fields and weights.
   *
   * @param query the search query
   * @param fields map of field names to their boost weights
   * @return a query string query builder
   */
  Q buildSearchQueryBuilder(String query, Map<String, Float> fields);

  /**
   * Build highlights for the specified fields.
   *
   * @param fields list of field names to highlight
   * @return a highlight builder
   */
  H buildHighlights(List<String> fields);

  /**
   * Create a search source builder with the specified query builder, highlights, and pagination.
   *
   * @param queryBuilder the query builder
   * @param highlightBuilder the highlight builder
   * @param from the starting offset
   * @param size the number of results to return
   * @return a search source builder
   */
  S searchBuilder(Q queryBuilder, H highlightBuilder, int from, int size);

  S addAggregationsToNLQQuery(S searchSourceBuilder, String indexName);

  default boolean containsQuerySyntax(String query) {
    if (query == null || query.isEmpty()) {
      return false;
    }
    query = query.replace("%20", " ").trim();
    return QUERY_SYNTAX_PATTERN.matcher(query).find();
  }
}
