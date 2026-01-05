package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.ColumnLineage;

/**
 * Utility class to match column filters against lineage edges.
 * Supports filtering by column names, tags, glossary terms, fromColumns, and toColumn.
 */
@Slf4j
public class ColumnFilterMatcher {

  private ColumnFilterMatcher() {}

  /**
   * Checks if an edge matches the column filter criteria.
   *
   * @param edge The lineage edge to check
   * @param columnFilter Filter expression (e.g., "columnName:customer_id", "tag:PII", "glossary:BusinessTerm")
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

    // Parse filter type and value
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

    // Parse filter type and value
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
