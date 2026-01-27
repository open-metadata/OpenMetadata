package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchUtil.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtil.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtil.isServiceIndex;
import static org.openmetadata.service.search.SearchUtil.isTimeSeriesIndex;
import static org.openmetadata.service.search.SearchUtil.mapEntityTypesToIndexNames;

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
    return getSearchSourceBuilder(indexName, searchQuery, fromOffset, size, includeExplain, true);
  }

  /**
   * Get the appropriate search source builder based on the index name.
   */
  default S getSearchSourceBuilder(
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
      // For consistency, use entity-specific search builder for dataAsset searches
      // This ensures both /search/query and /search/entityTypeCounts use the same logic
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

  S buildServiceSearchBuilderV2(String query, int from, int size);

  default S buildDataAssetSearchBuilderV2(String indexName, String query, int from, int size) {
    return buildDataAssetSearchBuilderV2(indexName, query, from, size, false, true);
  }

  default S buildDataAssetSearchBuilderV2(
      String indexName, String query, int from, int size, boolean explain) {
    return buildDataAssetSearchBuilderV2(indexName, query, from, size, explain, true);
  }

  S buildDataAssetSearchBuilderV2(
      String indexName,
      String query,
      int from,
      int size,
      boolean explain,
      boolean includeAggregations);

  S buildUserOrTeamSearchBuilderV2(String query, int from, int size);

  default S buildAggregateSearchBuilderV2(String query, int from, int size) {
    return buildAggregateSearchBuilderV2(query, from, size, true);
  }

  S buildAggregateSearchBuilderV2(String query, int from, int size, boolean includeAggregations);

  default S buildTimeSeriesSearchBuilderV2(String indexName, String query, int from, int size) {
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

  default S buildDataQualitySearchBuilderV2(String indexName, String query, int from, int size) {
    return switch (indexName) {
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearchV2(query, from, size);
      default -> buildAggregateSearchBuilderV2(query, from, size);
    };
  }

  S buildTestCaseSearchV2(String query, int from, int size);

  S buildTestCaseResultSearchV2(String query, int from, int size);

  S buildTestCaseResolutionStatusSearchV2(String query, int from, int size);

  S buildCostAnalysisReportDataSearchV2(String query, int from, int size);

  default AssetTypeConfiguration findAssetTypeConfig(
      String indexName, SearchSettings searchSettings) {
    String assetType = mapEntityTypesToIndexNames(indexName);
    return searchSettings.getAssetTypeConfigurations().stream()
        .filter(config -> config.getAssetType().equals(assetType))
        .findFirst()
        .orElse(searchSettings.getDefaultConfiguration());
  }

  /**
   * Build a search query builder with the specified fields and weights.
   */
  Q buildSearchQueryBuilderV2(String query, Map<String, Float> fields);

  /**
   * Build highlights for the specified fields.
   */
  H buildHighlightsV2(List<String> fields);

  /**
   * Create a search source builder with the specified query builder, highlights, and pagination.
   */
  S searchBuilderV2(Q queryBuilder, H highlightBuilder, int fromOffset, int size);

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
