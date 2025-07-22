package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchUtil.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtil.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtil.isServiceIndex;
import static org.openmetadata.service.search.SearchUtil.isTimeSeriesIndex;
import static org.openmetadata.service.search.SearchUtil.mapEntityTypesToIndexNames;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.Entity;

/**
 * Interface for creating search source builders for different entity types.
 * This interface provides a common contract for both ElasticSearch and OpenSearch implementations.
 *
 * <S> The SearchSourceBuilder type (different for ElasticSearch and OpenSearch)
 * <Q> The QueryBuilder type
 * <H> The HighlightBuilder type
 * <F> The FunctionScoreQueryBuilder type
 */
public interface SearchSourceBuilderFactory<S, Q, H, F> {

  Pattern QUERY_SYNTAX_PATTERN =
      Pattern.compile(
          "\\w+\\s*:\\s*\\w+|"
              + // Field queries (field:value)
              "\\b(?:AND|OR|NOT)\\b|"
              + // Boolean operators (uppercase only)
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

  Set<String> FUZZY_FIELDS =
      Set.of(
          "name",
          "displayName",
          "fullyQualifiedName",
          "columnNamesFuzzy",
          "fieldNamesFuzzy",
          "response_field_namesFuzzy",
          "request_field_namesFuzzy",
          "classification.name",
          "classification.displayName",
          "glossary.name",
          "glossary.displayName");

  // Keyword fields added to fuzzy because Lucene needs keyword fields for wildcard/prefix queries
  // in query_string
  Set<String> FUZZY_AND_NON_FUZZY_FIELDS =
      Set.of("name.keyword", "displayName.keyword", "fullyQualifiedName.keyword");

  /**
   * Get the appropriate search source builder based on the index name.
   */
  default S getSearchSourceBuilder(String indexName, String searchQuery, int fromOffset, int size) {
    return getSearchSourceBuilder(indexName, searchQuery, fromOffset, size, false);
  }

  /**
   * Get the appropriate search source builder based on the index name.
   */
  default S getSearchSourceBuilder(
      String indexName, String searchQuery, int fromOffset, int size, boolean includeExplain) {
    indexName = Entity.getSearchRepository().getIndexNameWithoutAlias(indexName);

    if (isTimeSeriesIndex(indexName)) {
      return buildTimeSeriesSearchBuilder(indexName, searchQuery, fromOffset, size);
    }

    if (isServiceIndex(indexName)) {
      return buildServiceSearchBuilder(searchQuery, fromOffset, size);
    }

    if (isDataQualityIndex(indexName)) {
      return buildDataQualitySearchBuilder(indexName, searchQuery, fromOffset, size);
    }

    if (isDataAssetIndex(indexName)) {
      return buildDataAssetSearchBuilder(indexName, searchQuery, fromOffset, size, includeExplain);
    }

    if (indexName.equals("all") || indexName.equals("dataAsset")) {
      // For consistency, use entity-specific search builder for dataAsset searches
      // This ensures both /search/query and /search/entityTypeCounts use the same logic
      return buildDataAssetSearchBuilder(indexName, searchQuery, fromOffset, size, includeExplain);
    }

    return switch (indexName) {
      case "user_search_index", "user", "team_search_index", "team" -> buildUserOrTeamSearchBuilder(
          searchQuery, fromOffset, size);
      default -> buildAggregateSearchBuilder(searchQuery, fromOffset, size);
    };
  }

  S buildServiceSearchBuilder(String query, int from, int size);

  S buildDataAssetSearchBuilder(String indexName, String query, int from, int size);

  S buildDataAssetSearchBuilder(
      String indexName, String query, int from, int size, boolean explain);

  S buildCommonSearchBuilder(String query, int from, int size);

  S buildEntitySpecificAggregateSearchBuilder(String query, int from, int size);

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
    String assetType = mapEntityTypesToIndexNames(indexName);
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
   */
  Q buildSearchQueryBuilder(String query, Map<String, Float> fields);

  /**
   * Build highlights for the specified fields.
   */
  H buildHighlights(List<String> fields);

  /**
   * Create a search source builder with the specified query builder, highlights, and pagination.
   */
  S searchBuilder(Q queryBuilder, H highlightBuilder, int fromOffset, int size);

  S addAggregationsToNLQQuery(S searchSourceBuilder, String indexName);

  default boolean containsQuerySyntax(String query) {
    if (query == null || query.isEmpty()) {
      return false;
    }
    query = query.replace("%20", " ").trim();
    return QUERY_SYNTAX_PATTERN.matcher(query).find();
  }

  default boolean isFuzzyField(String key) {
    if (FUZZY_AND_NON_FUZZY_FIELDS.contains(key)) {
      return true;
    }
    return FUZZY_FIELDS.contains(key);
  }

  default boolean isNonFuzzyField(String key) {
    if (FUZZY_AND_NON_FUZZY_FIELDS.contains(key)) {
      return true;
    }
    return !FUZZY_FIELDS.contains(key);
  }
}
