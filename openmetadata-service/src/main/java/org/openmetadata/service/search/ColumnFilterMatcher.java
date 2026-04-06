package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.ColumnLineage;

/**
 * Utility class to match column filters against lineage edges. Supports filtering by column names,
 * tags, glossary terms, fromColumns, and toColumn.
 *
 * <p>Filter format: comma-separated "type:value" pairs. Examples:
 *
 * <ul>
 *   <li>"columnName:customer_id" — matches edges with this column
 *   <li>"tag:PII.Sensitive" — matches edges with columns tagged PII.Sensitive
 *   <li>"glossary:BusinessGlossary.Term" — matches edges with this glossary term
 *   <li>"columnName:email,tag:PII" — AND across types, OR within same type
 * </ul>
 */
public class ColumnFilterMatcher {

  private ColumnFilterMatcher() {}

  /**
   * Checks if an edge matches the column filter criteria. Supports comma-separated multiple filters
   * and single filter format.
   *
   * <p>Comma-separated format: "columnName:val1,columnName:val2,tag:PII" - OR logic within same
   * filter type (multiple column names) - AND logic across different filter types (column name AND
   * tag)
   *
   * @param edge The lineage edge to check
   * @param columnFilter Filter expression (e.g., "columnName:customer_id", "tag:PII",
   *     "glossary:BusinessTerm")
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
   * Checks if an edge matches the column filter criteria with metadata cache. Supports
   * comma-separated multiple filters and single filter format.
   *
   * @param edge The lineage edge to check
   * @param columnFilter Filter expression
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
   * Filters the columns list of an edge to only include column lineages matching the filter.
   * Returns a new list with only matching ColumnLineage entries, or empty if none match.
   */
  public static List<ColumnLineage> filterMatchingColumns(EsLineageData edge, String columnFilter) {
    if (edge == null || nullOrEmpty(columnFilter)) {
      return edge != null ? edge.getColumns() : new ArrayList<>();
    }

    List<ColumnLineage> columns = edge.getColumns();
    if (nullOrEmpty(columns)) {
      return new ArrayList<>();
    }

    Map<String, List<String>> groupedFilters = getGroupedFilters(columnFilter);
    if (groupedFilters.isEmpty()) {
      return new ArrayList<>();
    }

    List<ColumnLineage> matching = new ArrayList<>();
    for (ColumnLineage colLineage : columns) {
      if (matchesGroupedCriteria(colLineage, groupedFilters)) {
        matching.add(colLineage);
      }
    }
    return matching;
  }

  /**
   * Filters the columns list of an edge using metadata cache for tag/glossary matching. Returns a
   * new list with only matching ColumnLineage entries.
   */
  public static List<ColumnLineage> filterMatchingColumnsWithMetadata(
      EsLineageData edge, String columnFilter, ColumnMetadataCache metadataCache) {
    if (edge == null || nullOrEmpty(columnFilter)) {
      return edge != null ? edge.getColumns() : new ArrayList<>();
    }

    List<ColumnLineage> columns = edge.getColumns();
    if (nullOrEmpty(columns)) {
      return new ArrayList<>();
    }

    Map<String, List<String>> groupedFilters = getGroupedFilters(columnFilter);
    if (groupedFilters.isEmpty()) {
      return new ArrayList<>();
    }

    List<ColumnLineage> matching = new ArrayList<>();
    for (ColumnLineage colLineage : columns) {
      if (matchesGroupedCriteriaWithMetadata(colLineage, groupedFilters, metadataCache)) {
        matching.add(colLineage);
      }
    }
    return matching;
  }

  /**
   * Parses filter into a grouped map (type → values) preserving OR-within-type, AND-across-types
   * semantics.
   */
  private static Map<String, List<String>> getGroupedFilters(String columnFilter) {
    Map<String, List<String>> grouped;
    if (columnFilter.contains(",")) {
      grouped = parseMultipleFiltersGrouped(columnFilter);
    } else {
      grouped = new HashMap<>();
      FilterCriteria criteria = parseColumnFilter(columnFilter);
      if (criteria != null) {
        grouped.computeIfAbsent(criteria.type, k -> new ArrayList<>()).add(criteria.value);
      }
    }
    return grouped;
  }

  /**
   * Checks if a single ColumnLineage matches grouped filters: OR within same type, AND across
   * types.
   */
  private static boolean matchesGroupedCriteria(
      ColumnLineage colLineage, Map<String, List<String>> groupedFilters) {
    for (Map.Entry<String, List<String>> entry : groupedFilters.entrySet()) {
      boolean anyMatch = false;
      for (String value : entry.getValue()) {
        if (matchesColumnLineage(colLineage, new FilterCriteria(entry.getKey(), value))) {
          anyMatch = true;
          break;
        }
      }
      if (!anyMatch) {
        return false;
      }
    }
    return true;
  }

  /**
   * Checks if a single ColumnLineage matches grouped filters with metadata: OR within same type,
   * AND across types.
   */
  private static boolean matchesGroupedCriteriaWithMetadata(
      ColumnLineage colLineage,
      Map<String, List<String>> groupedFilters,
      ColumnMetadataCache metadataCache) {
    for (Map.Entry<String, List<String>> entry : groupedFilters.entrySet()) {
      String filterType = entry.getKey();
      boolean anyMatch = false;
      for (String value : entry.getValue()) {
        FilterCriteria criteria = new FilterCriteria(filterType, value);
        if (requiresMetadata(criteria) && metadataCache != null) {
          ColumnMetadataCache.ColumnFilterCriteria metadataCriteria = toMetadataCriteria(criteria);
          if (metadataCriteria != null) {
            if (colLineage.getToColumn() != null
                && metadataCache.matchesFilter(colLineage.getToColumn(), metadataCriteria)) {
              anyMatch = true;
            }
            if (!anyMatch && colLineage.getFromColumns() != null) {
              for (String fromCol : colLineage.getFromColumns()) {
                if (metadataCache.matchesFilter(fromCol, metadataCriteria)) {
                  anyMatch = true;
                  break;
                }
              }
            }
          }
        } else {
          if (matchesColumnLineage(colLineage, criteria)) {
            anyMatch = true;
          }
        }
        if (anyMatch) {
          break;
        }
      }
      if (!anyMatch) {
        return false;
      }
    }
    return true;
  }

  /** Extracts all column FQNs from an edge for metadata loading. */
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
   * Parses column filter string into structured criteria. Supports formats:
   *
   * <ul>
   *   <li>"columnName:value" - matches any column with this name
   *   <li>"fromColumn:value" - matches source columns
   *   <li>"toColumn:value" - matches target columns
   *   <li>"tag:value" - matches columns with this tag
   *   <li>"glossary:value" - matches columns with this glossary term
   *   <li>"value" - matches any column containing this value
   * </ul>
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
        if (nullOrEmpty(filterType) || nullOrEmpty(filterValue)) {
          return null;
        }

        return new FilterCriteria(filterType, filterValue);
      }
    }

    // Default: match any column containing the value
    return new FilterCriteria("any", trimmed);
  }

  /**
   * Parses comma-separated filters and groups them by type. Returns a map where key is filter type
   * and value is list of filter values.
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

  /** Normalizes filter type to a canonical form, preserving directional semantics. */
  private static String normalizeFilterType(String type) {
    if (type == null) {
      return "any";
    }
    switch (type.toLowerCase()) {
      case "columnname":
      case "column":
      case "any":
        return "column";
      case "fromcolumn":
      case "from":
        return "fromcolumn";
      case "tocolumn":
      case "to":
        return "tocolumn";
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
   * Matches columns against multiple comma-separated filters. Logic: OR within same type, AND
   * across different types.
   */
  private static boolean matchesMultipleFilters(List<ColumnLineage> columns, String columnFilter) {
    Map<String, List<String>> groupedFilters = parseMultipleFiltersGrouped(columnFilter);

    if (groupedFilters.isEmpty()) {
      return false;
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
   * Matches columns against multiple comma-separated filters with metadata cache. Logic: OR within
   * same type, AND across different types.
   */
  private static boolean matchesMultipleFiltersWithMetadata(
      List<ColumnLineage> columns, String columnFilter, ColumnMetadataCache metadataCache) {
    Map<String, List<String>> groupedFilters = parseMultipleFiltersGrouped(columnFilter);

    if (groupedFilters.isEmpty()) {
      return false;
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

  /** Checks if the column filter requires metadata (tags, glossary terms) for matching. */
  public static boolean requiresMetadataForFilter(String columnFilter) {
    if (nullOrEmpty(columnFilter)) {
      return false;
    }

    // Handle comma-separated filters (e.g., "columnName:val,tag:PII")
    if (columnFilter.contains(",")) {
      Map<String, List<String>> grouped = parseMultipleFiltersGrouped(columnFilter);
      for (String filterType : grouped.keySet()) {
        if (filterType.equals("tag") || filterType.equals("glossary")) {
          return true;
        }
      }
      return false;
    }

    // Single filter format
    FilterCriteria criteria = parseColumnFilter(columnFilter);
    return criteria != null && requiresMetadata(criteria);
  }

  /** Checks if filter requires metadata (tags, glossary terms). */
  private static boolean requiresMetadata(FilterCriteria criteria) {
    if (criteria == null) {
      return false;
    }

    return criteria.type.equals("tag")
        || criteria.type.equals("glossary")
        || criteria.type.equals("tags");
  }

  /** Converts FilterCriteria to ColumnMetadataCache.ColumnFilterCriteria. */
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

  /** Matches column lineage with metadata cache. */
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

  /** Checks if a column lineage matches the filter criteria. */
  private static boolean matchesColumnLineage(ColumnLineage colLineage, FilterCriteria criteria) {
    if (colLineage == null || criteria == null) {
      return false;
    }

    String filterValue = criteria.value.toLowerCase();

    switch (criteria.type) {
      case "columnname":
      case "column":
        return matchesFromColumns(colLineage, filterValue)
            || matchesToColumn(colLineage, filterValue);

      case "fromcolumn":
      case "from":
        return matchesFromColumns(colLineage, filterValue);

      case "tocolumn":
      case "to":
        return matchesToColumn(colLineage, filterValue);

      case "any":
      default:
        return matchesFromColumns(colLineage, filterValue)
            || matchesToColumn(colLineage, filterValue);
    }
  }

  /** Checks if any fromColumn matches the filter value. */
  private static boolean matchesFromColumns(ColumnLineage colLineage, String filterValue) {
    if (nullOrEmpty(colLineage.getFromColumns())) {
      return false;
    }

    for (String fromCol : colLineage.getFromColumns()) {
      if (matchesColumnName(fromCol, filterValue)) {
        return true;
      }
    }

    return false;
  }

  /** Checks if toColumn matches the filter value. */
  private static boolean matchesToColumn(ColumnLineage colLineage, String filterValue) {
    String toCol = colLineage.getToColumn();
    return matchesColumnName(toCol, filterValue);
  }

  /**
   * Checks if a column name matches the filter value. Supports exact match, FQN match (last part),
   * and partial match (contains).
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

  /** Internal class to hold parsed filter criteria. */
  private static class FilterCriteria {
    final String type;
    final String value;

    FilterCriteria(String type, String value) {
      this.type = type;
      this.value = value;
    }
  }
}
