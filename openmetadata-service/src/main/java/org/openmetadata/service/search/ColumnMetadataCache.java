package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;

/**
 * Cache for column metadata (tags, glossary terms) fetched from parent entities.
 * This is needed because lineage edges only store column FQNs, not full column metadata.
 */
@Slf4j
public class ColumnMetadataCache {

  private final Map<String, ColumnMetadata> cache;

  public ColumnMetadataCache() {
    this.cache = new HashMap<>();
  }

  /**
   * Loads column metadata for a set of column FQNs by fetching their parent entities.
   *
   * @param columnFqns Set of column FQNs to load metadata for
   * @param entityFetcher Function to fetch entity documents by FQN
   */
  public void loadColumnMetadata(Set<String> columnFqns, EntityDocumentFetcher entityFetcher)
      throws IOException {
    // Group column FQNs by parent entity FQN
    Map<String, Set<String>> entityToColumns = new HashMap<>();

    for (String columnFqn : columnFqns) {
      String parentFqn = extractParentFqn(columnFqn);
      if (parentFqn != null) {
        entityToColumns.computeIfAbsent(parentFqn, k -> new HashSet<>()).add(columnFqn);
      }
    }

    // Fetch parent entities and extract column metadata
    for (Map.Entry<String, Set<String>> entry : entityToColumns.entrySet()) {
      String parentFqn = entry.getKey();
      try {
        Map<String, Object> entityDoc = entityFetcher.fetchEntity(parentFqn);
        extractColumnMetadata(entityDoc, entry.getValue());
      } catch (Exception e) {
        LOG.warn("Failed to fetch metadata for parent entity: {}", parentFqn, e);
      }
    }
  }

  /**
   * Gets column metadata from cache.
   */
  public ColumnMetadata getColumnMetadata(String columnFqn) {
    return cache.get(columnFqn);
  }

  /**
   * Checks if a column matches the given filter criteria.
   */
  public boolean matchesFilter(String columnFqn, ColumnFilterCriteria criteria) {
    ColumnMetadata metadata = cache.get(columnFqn);
    if (metadata == null) {
      return false;
    }

    switch (criteria.getFilterType()) {
      case TAG:
        return hasMatchingTag(metadata, criteria.getFilterValue());

      case GLOSSARY:
        return hasMatchingGlossaryTerm(metadata, criteria.getFilterValue());

      case NAME:
        return matchesColumnName(columnFqn, criteria.getFilterValue());

      default:
        return false;
    }
  }

  /**
   * Extracts parent entity FQN from column FQN.
   * Example: "service.db.schema.table.column" -> "service.db.schema.table"
   */
  private String extractParentFqn(String columnFqn) {
    if (nullOrEmpty(columnFqn)) {
      return null;
    }

    int lastDot = columnFqn.lastIndexOf('.');
    if (lastDot > 0) {
      return columnFqn.substring(0, lastDot);
    }

    return null;
  }

  /**
   * Extracts column metadata from parent entity document.
   */
  private void extractColumnMetadata(Map<String, Object> entityDoc, Set<String> columnFqns) {
    if (entityDoc == null || !entityDoc.containsKey("columns")) {
      return;
    }

    Object columnsObj = entityDoc.get("columns");
    if (!(columnsObj instanceof List)) {
      return;
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> columns = (List<Map<String, Object>>) columnsObj;

    for (Map<String, Object> column : columns) {
      String columnFqn = (String) column.get("fullyQualifiedName");
      if (columnFqn != null && columnFqns.contains(columnFqn)) {
        ColumnMetadata metadata = new ColumnMetadata();

        // Extract tags
        if (column.containsKey("tags") && column.get("tags") instanceof List) {
          @SuppressWarnings("unchecked")
          List<Map<String, Object>> tags = (List<Map<String, Object>>) column.get("tags");
          Set<String> tagFqns = new HashSet<>();
          for (Map<String, Object> tag : tags) {
            if (tag.containsKey("tagFQN")) {
              tagFqns.add((String) tag.get("tagFQN"));
            }
          }
          metadata.setTags(tagFqns);
        }

        cache.put(columnFqn, metadata);
      }
    }
  }

  /**
   * Checks if column has a matching tag.
   */
  private boolean hasMatchingTag(ColumnMetadata metadata, String tagFilter) {
    if (metadata.getTags() == null || metadata.getTags().isEmpty()) {
      return false;
    }

    String filterLower = tagFilter.toLowerCase();
    for (String tagFqn : metadata.getTags()) {
      if (tagFqn.toLowerCase().contains(filterLower)
          || tagFqn.toLowerCase().endsWith("." + filterLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if column has a matching glossary term.
   */
  private boolean hasMatchingGlossaryTerm(ColumnMetadata metadata, String glossaryFilter) {
    // For now, glossary terms are stored as tags with type GLOSSARY
    // This can be enhanced to check tag source/type
    return hasMatchingTag(metadata, glossaryFilter);
  }

  /**
   * Checks if column name matches filter.
   */
  private boolean matchesColumnName(String columnFqn, String nameFilter) {
    if (columnFqn == null || nameFilter == null) {
      return false;
    }

    String colLower = columnFqn.toLowerCase();
    String filterLower = nameFilter.toLowerCase();

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

    // Partial match
    return colLower.contains(filterLower);
  }

  /**
   * Column metadata holder.
   */
  public static class ColumnMetadata {
    private Set<String> tags;

    public Set<String> getTags() {
      return tags;
    }

    public void setTags(Set<String> tags) {
      this.tags = tags;
    }
  }

  /**
   * Filter criteria for column filtering.
   */
  public static class ColumnFilterCriteria {
    private final FilterType filterType;
    private final String filterValue;

    public ColumnFilterCriteria(FilterType filterType, String filterValue) {
      this.filterType = filterType;
      this.filterValue = filterValue;
    }

    public FilterType getFilterType() {
      return filterType;
    }

    public String getFilterValue() {
      return filterValue;
    }

    public enum FilterType {
      TAG,
      GLOSSARY,
      NAME
    }
  }

  /**
   * Functional interface for fetching entity documents.
   */
  @FunctionalInterface
  public interface EntityDocumentFetcher {
    Map<String, Object> fetchEntity(String fqn) throws IOException;
  }
}
