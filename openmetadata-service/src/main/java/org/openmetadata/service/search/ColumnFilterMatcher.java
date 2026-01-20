package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Utility class to match column filters against lineage edges.
 * Supports filtering by column names, tags, glossary terms, fromColumns, and toColumn.
 */
@Slf4j
public class ColumnFilterMatcher {

  private ColumnFilterMatcher() {}

  /**
   * Checks if an edge matches the column filter criteria.
   * Supports ES query JSON format, comma-separated multiple filters, and single filter format.
   *
   * Comma-separated format: "columnName:val1,columnName:val2,tag:PII"
   * - OR logic within same filter type (multiple column names)
   * - AND logic across different filter types (column name AND tag)
   *
   * @param edge The lineage edge to check
   * @param columnFilter Filter expression - can be ES query JSON, comma-separated, or single filter
   *     (e.g., "columnName:customer_id", "tag:PII", "glossary:BusinessTerm")
   * @return true if the edge matches the filter
   */
  public static boolean matchesColumnFilter(EsLineageData edge, String columnFilter) {
    if (edge == null || nullOrEmpty(columnFilter)) {
      return true;
    }

    List<ColumnLineage> columns = edge.getColumns();
    if (nullOrEmpty(columns)) {
      return false;
    }

    // Check if filter is ES query JSON format
    if (isEsQueryFormat(columnFilter)) {
      List<FilterCriteria> criteriaList = parseEsQueryFilter(columnFilter);
      if (criteriaList.isEmpty()) {
        return true;
      }
      // All criteria must match (AND logic between different filter types)
      for (FilterCriteria criteria : criteriaList) {
        boolean anyColumnMatches = false;
        for (ColumnLineage colLineage : columns) {
          if (matchesColumnLineage(colLineage, criteria)) {
            anyColumnMatches = true;
            break;
          }
        }
        if (!anyColumnMatches) {
          return false;
        }
      }
      return true;
    }

    // Check for comma-separated multiple filters
    if (columnFilter.contains(",")) {
      return matchesMultipleFilters(columns, columnFilter);
    }

    // Single filter format parsing
    FilterCriteria criteria = parseColumnFilter(columnFilter);
    if (criteria == null) {
      return false;
    }

    // Check each column lineage
    for (ColumnLineage colLineage : columns) {
      if (matchesColumnLineage(colLineage, criteria)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if an edge matches the column filter criteria with metadata cache.
   * Supports ES query JSON format, comma-separated multiple filters, and single filter format.
   *
   * @param edge The lineage edge to check
   * @param columnFilter Filter expression - can be ES query JSON, comma-separated, or single filter
   * @param metadataCache Cache containing column metadata (tags, glossary terms)
   * @return true if the edge matches the filter
   */
  public static boolean matchesColumnFilter(
      EsLineageData edge, String columnFilter, ColumnMetadataCache metadataCache) {
    if (edge == null || nullOrEmpty(columnFilter)) {
      return true;
    }

    List<ColumnLineage> columns = edge.getColumns();
    if (nullOrEmpty(columns)) {
      return false;
    }

    // Check if filter is ES query JSON format
    if (isEsQueryFormat(columnFilter)) {
      List<FilterCriteria> criteriaList = parseEsQueryFilter(columnFilter);
      if (criteriaList.isEmpty()) {
        return true;
      }
      // All criteria must match (AND logic between different filter types)
      for (FilterCriteria criteria : criteriaList) {
        boolean anyColumnMatches = false;
        // Check if filter requires metadata (tags, glossary)
        if (requiresMetadata(criteria) && metadataCache != null) {
          ColumnMetadataCache.ColumnFilterCriteria metadataCriteria = toMetadataCriteria(criteria);
          if (metadataCriteria != null) {
            anyColumnMatches =
                matchesColumnLineageWithMetadata(columns, metadataCriteria, metadataCache);
          }
        } else {
          for (ColumnLineage colLineage : columns) {
            if (matchesColumnLineage(colLineage, criteria)) {
              anyColumnMatches = true;
              break;
            }
          }
        }
        if (!anyColumnMatches) {
          return false;
        }
      }
      return true;
    }

    // Check for comma-separated multiple filters
    if (columnFilter.contains(",")) {
      return matchesMultipleFiltersWithMetadata(columns, columnFilter, metadataCache);
    }

    // Single filter format parsing
    FilterCriteria criteria = parseColumnFilter(columnFilter);
    if (criteria == null) {
      return false;
    }

    // Check if filter requires metadata (tags, glossary)
    if (requiresMetadata(criteria) && metadataCache != null) {
      ColumnMetadataCache.ColumnFilterCriteria metadataCriteria = toMetadataCriteria(criteria);
      if (metadataCriteria != null) {
        return matchesColumnLineageWithMetadata(columns, metadataCriteria, metadataCache);
      }
    }

    // Fall back to name-based matching
    for (ColumnLineage colLineage : columns) {
      if (matchesColumnLineage(colLineage, criteria)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extracts all column FQNs from an edge for metadata loading.
   */
  public static Set<String> extractColumnFqns(EsLineageData edge) {
    Set<String> columnFqns = new HashSet<>();

    if (edge == null || edge.getColumns() == null) {
      return columnFqns;
    }

    for (ColumnLineage colLineage : edge.getColumns()) {
      if (colLineage.getToColumn() != null) {
        columnFqns.add(colLineage.getToColumn());
      }
      if (colLineage.getFromColumns() != null) {
        columnFqns.addAll(colLineage.getFromColumns());
      }
    }

    return columnFqns;
  }

  /**
   * Parses column filter string into structured criteria.
   * Supports formats:
   * - "columnName:value" - matches any column with this name
   * - "fromColumn:value" - matches source columns
   * - "toColumn:value" - matches target columns
   * - "tag:value" - matches columns with this tag
   * - "glossary:value" - matches columns with this glossary term
   * - "value" - matches any column containing this value
   */
  private static FilterCriteria parseColumnFilter(String columnFilter) {
    if (nullOrEmpty(columnFilter)) {
      return null;
    }

    String trimmed = columnFilter.trim();

    if (trimmed.contains(":")) {
      String[] parts = trimmed.split(":", 2);
      if (parts.length == 2) {
        String filterType = parts[0].trim().toLowerCase();
        String filterValue = parts[1].trim();

        return new FilterCriteria(filterType, filterValue);
      }
    }

    // Default: match any column containing the value
    return new FilterCriteria("any", trimmed);
  }

  /**
   * Parses comma-separated filters and groups them by type.
   * Returns a map where key is filter type and value is list of filter values.
   */
  private static Map<String, List<String>> parseMultipleFiltersGrouped(String columnFilter) {
    Map<String, List<String>> grouped = new HashMap<>();

    if (nullOrEmpty(columnFilter)) {
      return grouped;
    }

    String[] filters = columnFilter.split(",");
    for (String filter : filters) {
      FilterCriteria criteria = parseColumnFilter(filter.trim());
      if (criteria != null) {
        String normalizedType = normalizeFilterType(criteria.type);
        grouped.computeIfAbsent(normalizedType, k -> new ArrayList<>()).add(criteria.value);
      }
    }

    return grouped;
  }

  /**
   * Normalizes filter type to a canonical form.
   */
  private static String normalizeFilterType(String type) {
    if (type == null) {
      return "any";
    }
    switch (type.toLowerCase()) {
      case "columnname":
      case "column":
      case "fromcolumn":
      case "from":
      case "tocolumn":
      case "to":
      case "any":
        return "column";
      case "tag":
      case "tags":
        return "tag";
      case "glossary":
        return "glossary";
      default:
        return "column";
    }
  }

  /**
   * Matches columns against multiple comma-separated filters.
   * Logic: OR within same type, AND across different types.
   */
  private static boolean matchesMultipleFilters(List<ColumnLineage> columns, String columnFilter) {
    Map<String, List<String>> groupedFilters = parseMultipleFiltersGrouped(columnFilter);

    if (groupedFilters.isEmpty()) {
      return true;
    }

    // Each filter type must have at least one match (AND between types)
    for (Map.Entry<String, List<String>> entry : groupedFilters.entrySet()) {
      String filterType = entry.getKey();
      List<String> filterValues = entry.getValue();

      boolean anyMatchForType = false;

      // Check if ANY value within this type matches (OR within type)
      for (String filterValue : filterValues) {
        FilterCriteria criteria = new FilterCriteria(filterType, filterValue);
        for (ColumnLineage colLineage : columns) {
          if (matchesColumnLineage(colLineage, criteria)) {
            anyMatchForType = true;
            break;
          }
        }
        if (anyMatchForType) {
          break;
        }
      }

      // If no match found for this type, overall result is false
      if (!anyMatchForType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Matches columns against multiple comma-separated filters with metadata cache.
   * Logic: OR within same type, AND across different types.
   */
  private static boolean matchesMultipleFiltersWithMetadata(
      List<ColumnLineage> columns, String columnFilter, ColumnMetadataCache metadataCache) {
    Map<String, List<String>> groupedFilters = parseMultipleFiltersGrouped(columnFilter);

    if (groupedFilters.isEmpty()) {
      return true;
    }

    // Each filter type must have at least one match (AND between types)
    for (Map.Entry<String, List<String>> entry : groupedFilters.entrySet()) {
      String filterType = entry.getKey();
      List<String> filterValues = entry.getValue();

      boolean anyMatchForType = false;

      // Check if ANY value within this type matches (OR within type)
      for (String filterValue : filterValues) {
        FilterCriteria criteria = new FilterCriteria(filterType, filterValue);

        // Check if filter requires metadata (tags, glossary)
        if (requiresMetadata(criteria) && metadataCache != null) {
          ColumnMetadataCache.ColumnFilterCriteria metadataCriteria = toMetadataCriteria(criteria);
          if (metadataCriteria != null) {
            anyMatchForType =
                matchesColumnLineageWithMetadata(columns, metadataCriteria, metadataCache);
          }
        } else {
          for (ColumnLineage colLineage : columns) {
            if (matchesColumnLineage(colLineage, criteria)) {
              anyMatchForType = true;
              break;
            }
          }
        }

        if (anyMatchForType) {
          break;
        }
      }

      // If no match found for this type, overall result is false
      if (!anyMatchForType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the column filter is in ES query JSON format.
   */
  private static boolean isEsQueryFormat(String columnFilter) {
    if (nullOrEmpty(columnFilter)) {
      return false;
    }
    String trimmed = columnFilter.trim();
    return trimmed.startsWith("{") && trimmed.endsWith("}");
  }

  /**
   * Parses ES query JSON format column filter into a list of filter criteria.
   * Supports ES query structure with wildcard, term queries for columns.
   *
   * Expected format:
   * {
   *   "query": {
   *     "bool": {
   *       "must": [
   *         { "bool": { "should": [ { "wildcard": { "columns.fromColumns": "*value*" } } ] } },
   *         { "term": { "columns.tags.tagFQN": "tagValue" } },
   *         { "term": { "columns.glossaryTerms.tagFQN": "glossaryValue" } }
   *       ]
   *     }
   *   }
   * }
   */
  private static List<FilterCriteria> parseEsQueryFilter(String columnFilter) {
    List<FilterCriteria> criteriaList = new ArrayList<>();

    if (nullOrEmpty(columnFilter)) {
      return criteriaList;
    }

    try {
      JsonNode rootNode = JsonUtils.readTree(columnFilter);
      JsonNode queryNode = rootNode.path("query");
      JsonNode boolNode = queryNode.path("bool");
      JsonNode mustNode = boolNode.path("must");

      if (mustNode.isArray()) {
        for (JsonNode mustClause : mustNode) {
          extractCriteriaFromClause(mustClause, criteriaList);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse ES query column filter: {}", columnFilter, e);
    }

    return criteriaList;
  }

  /**
   * Extracts filter criteria from an ES query clause (bool, wildcard, term).
   */
  private static void extractCriteriaFromClause(
      JsonNode clause, List<FilterCriteria> criteriaList) {
    if (clause == null) {
      return;
    }

    // Handle nested bool with should
    JsonNode boolNode = clause.path("bool");
    if (!boolNode.isMissingNode()) {
      JsonNode shouldNode = boolNode.path("should");
      if (shouldNode.isArray()) {
        for (JsonNode shouldClause : shouldNode) {
          extractCriteriaFromClause(shouldClause, criteriaList);
        }
      }
      return;
    }

    // Handle wildcard queries (for column names)
    JsonNode wildcardNode = clause.path("wildcard");
    if (!wildcardNode.isMissingNode()) {
      wildcardNode
          .fields()
          .forEachRemaining(
              entry -> {
                String field = entry.getKey();
                String value = entry.getValue().asText();
                // Remove wildcards from value for matching
                String cleanValue = value.replace("*", "");
                if (field.contains("fromColumns") || field.contains("toColumn")) {
                  criteriaList.add(new FilterCriteria("column", cleanValue));
                }
              });
      return;
    }

    // Handle term queries (for tags and glossary)
    JsonNode termNode = clause.path("term");
    if (!termNode.isMissingNode()) {
      termNode
          .fields()
          .forEachRemaining(
              entry -> {
                String field = entry.getKey();
                String value = entry.getValue().asText();
                if (field.contains("tags.tagFQN")) {
                  criteriaList.add(new FilterCriteria("tag", value));
                } else if (field.contains("glossaryTerms.tagFQN")) {
                  criteriaList.add(new FilterCriteria("glossary", value));
                }
              });
    }
  }

  /**
   * Checks if the column filter (either ES query or legacy format) requires metadata.
   */
  public static boolean requiresMetadataForFilter(String columnFilter) {
    if (nullOrEmpty(columnFilter)) {
      return false;
    }

    if (isEsQueryFormat(columnFilter)) {
      List<FilterCriteria> criteriaList = parseEsQueryFilter(columnFilter);
      for (FilterCriteria criteria : criteriaList) {
        if (requiresMetadata(criteria)) {
          return true;
        }
      }
      return false;
    }

    // Legacy format
    FilterCriteria criteria = parseColumnFilter(columnFilter);
    return criteria != null && requiresMetadata(criteria);
  }

  /**
   * Checks if filter requires metadata (tags, glossary terms).
   */
  private static boolean requiresMetadata(FilterCriteria criteria) {
    if (criteria == null) {
      return false;
    }

    return criteria.type.equals("tag")
        || criteria.type.equals("glossary")
        || criteria.type.equals("tags");
  }

  /**
   * Converts FilterCriteria to ColumnMetadataCache.ColumnFilterCriteria.
   */
  private static ColumnMetadataCache.ColumnFilterCriteria toMetadataCriteria(
      FilterCriteria criteria) {
    if (criteria == null) {
      return null;
    }

    if (criteria.type.equals("tag") || criteria.type.equals("tags")) {
      return new ColumnMetadataCache.ColumnFilterCriteria(
          ColumnMetadataCache.ColumnFilterCriteria.FilterType.TAG, criteria.value);
    } else if (criteria.type.equals("glossary")) {
      return new ColumnMetadataCache.ColumnFilterCriteria(
          ColumnMetadataCache.ColumnFilterCriteria.FilterType.GLOSSARY, criteria.value);
    } else {
      return new ColumnMetadataCache.ColumnFilterCriteria(
          ColumnMetadataCache.ColumnFilterCriteria.FilterType.NAME, criteria.value);
    }
  }

  /**
   * Matches column lineage with metadata cache.
   */
  private static boolean matchesColumnLineageWithMetadata(
      List<ColumnLineage> columns,
      ColumnMetadataCache.ColumnFilterCriteria criteria,
      ColumnMetadataCache cache) {

    for (ColumnLineage colLineage : columns) {
      // Check toColumn
      if (colLineage.getToColumn() != null
          && cache.matchesFilter(colLineage.getToColumn(), criteria)) {
        return true;
      }

      // Check fromColumns
      if (colLineage.getFromColumns() != null) {
        for (String fromCol : colLineage.getFromColumns()) {
          if (cache.matchesFilter(fromCol, criteria)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Checks if a column lineage matches the filter criteria.
   */
  private static boolean matchesColumnLineage(ColumnLineage colLineage, FilterCriteria criteria) {
    if (colLineage == null || criteria == null) {
      return false;
    }

    String filterValue = criteria.value.toLowerCase();

    switch (criteria.type) {
      case "columnname":
      case "column":
        // Match column name in fromColumns or toColumn
        return matchesFromColumns(colLineage, filterValue)
            || matchesToColumn(colLineage, filterValue);

      case "fromcolumn":
      case "from":
        // Match only fromColumns
        return matchesFromColumns(colLineage, filterValue);

      case "tocolumn":
      case "to":
        // Match only toColumn
        return matchesToColumn(colLineage, filterValue);

      case "any":
      default:
        // Match any column containing the value
        return matchesFromColumns(colLineage, filterValue)
            || matchesToColumn(colLineage, filterValue);
    }
  }

  /**
   * Checks if any fromColumn matches the filter value.
   */
  private static boolean matchesFromColumns(ColumnLineage colLineage, String filterValue) {
    if (nullOrEmpty(colLineage.getFromColumns())) {
      return false;
    }

    for (String fromCol : colLineage.getFromColumns()) {
      if (fromCol != null && matchesColumnName(fromCol, filterValue)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if toColumn matches the filter value.
   */
  private static boolean matchesToColumn(ColumnLineage colLineage, String filterValue) {
    String toCol = colLineage.getToColumn();
    return toCol != null && matchesColumnName(toCol, filterValue);
  }

  /**
   * Checks if a column name matches the filter value.
   * Supports:
   * - Exact match: "customer_id" matches "customer_id"
   * - FQN match: "customer_id" matches "schema.table.customer_id"
   * - Partial match: "customer" matches "customer_id"
   */
  private static boolean matchesColumnName(String columnFqn, String filterValue) {
    if (columnFqn == null || filterValue == null) {
      return false;
    }

    String colLower = columnFqn.toLowerCase();
    String filterLower = filterValue.toLowerCase();

    // Exact match
    if (colLower.equals(filterLower)) {
      return true;
    }

    // Match by column name (last part of FQN)
    String[] parts = colLower.split("\\.");
    String columnName = parts[parts.length - 1];
    if (columnName.equals(filterLower)) {
      return true;
    }

    // Partial match (contains)
    return colLower.contains(filterLower);
  }

  /**
   * Internal class to hold parsed filter criteria.
   */
  private static class FilterCriteria {
    final String type;
    final String value;

    FilterCriteria(String type, String value) {
      this.type = type;
      this.value = value;
    }
  }
}
