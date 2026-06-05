package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchUtils.isDataAssetIndex;
import static org.openmetadata.service.search.SearchUtils.isDataQualityIndex;
import static org.openmetadata.service.search.SearchUtils.isServiceIndex;
import static org.openmetadata.service.search.SearchUtils.isTimeSeriesIndex;
import static org.openmetadata.service.search.SearchUtils.mapEntityTypesToIndexNames;

import java.util.ArrayList;
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

  /**
   * Remap nested owner field paths to their flat top-level equivalents. The flat fields {@code
   * ownerDisplayName} and {@code ownerName} are denormalized copies maintained in every search
   * index.
   */
  Map<String, String> AGGREGATION_FIELD_REMAPS =
      Map.of(
          "owners.displayName.keyword", "ownerDisplayName",
          "owners.displayName", "ownerDisplayName",
          "owners.name.keyword", "ownerName",
          "owners.name", "ownerName");

  /**
   * Root-level text fields that carry a {@code .keyword} sub-field in all index mappings. Only
   * exact root-level names match; dotted paths (e.g. {@code columns.name}) are not resolved here.
   */
  Set<String> TEXT_FIELDS_WITH_KEYWORD = Set.of("name", "displayName");

  /**
   * Flat keyword fields produced by owner-field remapping. These do not carry a {@code .keyword}
   * suffix but must be treated as keyword sort fields for correct {@code unmappedType} resolution.
   */
  Set<String> KEYWORD_SORT_FIELDS = Set.of("ownerDisplayName", "ownerName");

  /**
   * Resolve a field name for use in sorting or aggregation contexts.
   *
   * <ul>
   *   <li>Applies owner-field remapping (e.g. {@code owners.displayName.keyword} &rarr; {@code
   *       ownerDisplayName})
   *   <li>Passes through ES/OS internal fields that start with {@code _}
   *   <li>Passes through fields already ending with {@code .keyword}
   *   <li>Appends {@code .keyword} to root-level fields that exactly match {@code
   *       TEXT_FIELDS_WITH_KEYWORD} ({@code name}, {@code displayName}); dotted paths pass through
   *       unchanged
   *   <li>Passes through all other fields (numeric, date, keyword-typed) unchanged
   * </ul>
   */
  static String resolveFieldForSortOrAggregation(String field) {
    if (field == null || field.isEmpty()) {
      return field;
    }
    String remapped = AGGREGATION_FIELD_REMAPS.getOrDefault(field, field);
    if (!remapped.equals(field)) {
      return remapped;
    }
    if (field.startsWith("_")) {
      return field;
    }
    if (field.endsWith(".keyword")) {
      return field;
    }
    if (TEXT_FIELDS_WITH_KEYWORD.contains(field)) {
      return field + ".keyword";
    }
    return field;
  }

  /**
   * Field paths that are mapped as {@code flattened} (Elasticsearch) / {@code flat_object}
   * (OpenSearch) across the index mappings under {@code
   * openmetadata-spec/src/main/resources/elasticsearch/}.
   *
   * <p>Subfields of these mappings (e.g. {@code extension.foundry_rid}, {@code
   * columns.extension.something}) are stored as raw keywords without an analyzer. Using them in a
   * highlight clause causes the search engine to fail the highlight phase at the shard level with
   * {@code "Field [...] has no associated analyzer"}, which surfaces as an {@code all shards
   * failed} error from the query endpoint and breaks any workflow (e.g. Automator) that runs that
   * query.
   *
   * <p>If a new flattened field is added to any index mapping, add its dotted path here so that
   * misconfigured highlight fields don't break search at runtime.
   */
  Set<String> FLATTENED_FIELD_PATHS =
      Set.of(
          "extension",
          "columns.extension",
          "columns.children",
          "dataModel.columns.extension",
          "dataModel.columns.children",
          "fields.children",
          "messageSchema.schemaFields.children",
          "requestSchema.schemaFields.children",
          "responseSchema.schemaFields.children");

  /**
   * Returns {@code true} when {@code field} is a flattened path or a subfield of one. Subfields of
   * {@code flattened}/{@code flat_object} mappings have no analyzer and cannot be used in a
   * highlight clause.
   */
  static boolean isHighlightUnsafeField(String field) {
    boolean unsafe = false;
    if (field != null && !field.isEmpty()) {
      for (String root : FLATTENED_FIELD_PATHS) {
        if (field.equals(root) || field.startsWith(root + ".")) {
          unsafe = true;
          break;
        }
      }
    }
    return unsafe;
  }

  /**
   * Filter highlight-unsafe fields (flattened paths and their subfields) out of the configured
   * list. The returned list preserves the original order of safe fields. When no field is unsafe
   * — the common case on the {@code /v1/search/query} hot path — the original {@code fields} list
   * is returned as-is to avoid an allocation and copy; a new list is built only when something is
   * actually dropped. A {@code null} input yields an empty list (never {@code null}) so callers can
   * iterate the result unconditionally. Callers should compare against the input to detect — and
   * log — dropped fields once per request.
   */
  static List<String> filterHighlightSafeFields(List<String> fields) {
    List<String> result = fields == null ? List.of() : fields;
    boolean hasUnsafe =
        fields != null
            && fields.stream().anyMatch(SearchSourceBuilderFactory::isHighlightUnsafeField);
    if (hasUnsafe) {
      List<String> safe = new ArrayList<>(fields.size());
      for (String field : fields) {
        if (!isHighlightUnsafeField(field)) {
          safe.add(field);
        }
      }
      result = safe;
    }
    return result;
  }
}
