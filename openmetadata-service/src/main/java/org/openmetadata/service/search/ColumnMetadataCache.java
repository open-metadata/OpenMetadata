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
  private final Set<String> loadedParentFqns;

  public ColumnMetadataCache() {
    this.cache = new HashMap<>();
    this.loadedParentFqns = new HashSet<>();
  }

  /**
   * Loads column metadata for a set of column FQNs by fetching their parent entities.
   *
   * @param columnFqns Set of column FQNs to load metadata for
   * @param entityFetcher Function to fetch entity documents by FQN
   */
  public void loadColumnMetadata(Set<String> columnFqns, EntityDocumentFetcher entityFetcher) {
    Map<String, Set<String>> entityToColumns = groupColumnsByParent(columnFqns);
    loadColumnMetadata(entityToColumns, entityFetcher);
  }

  /**
   * Loads column metadata using a batched parent-entity fetcher with per-entity fallback.
   *
   * @param columnFqns Set of column FQNs to load metadata for
   * @param batchEntityFetcher Function to fetch multiple entity documents in one request
   * @param fallbackFetcher Single-entity fallback used when batch loading fails
   */
  public void loadColumnMetadata(
      Set<String> columnFqns,
      BatchEntityDocumentFetcher batchEntityFetcher,
      EntityDocumentFetcher fallbackFetcher) {
    Map<String, Set<String>> entityToColumns = groupColumnsByParent(columnFqns);
    entityToColumns.entrySet().removeIf(entry -> loadedParentFqns.contains(entry.getKey()));

    if (entityToColumns.isEmpty()) {
      return;
    }

    try {
      Map<String, Map<String, Object>> entityDocs =
          batchEntityFetcher.fetchEntities(entityToColumns.keySet());
      for (Map.Entry<String, Set<String>> entry : entityToColumns.entrySet()) {
        String parentFqn = entry.getKey();
        Map<String, Object> entityDoc = entityDocs.get(parentFqn);
        if (entityDoc == null) {
          LOG.debug("No column metadata document returned for parent entity: {}", parentFqn);
          continue;
        }

        extractColumnMetadata(parentFqn, entityDoc, entry.getValue());
        loadedParentFqns.add(parentFqn);
      }
    } catch (Exception e) {
      LOG.warn("Failed to batch fetch column metadata, falling back to per-entity fetches", e);
      loadColumnMetadata(entityToColumns, fallbackFetcher);
    }
  }

  private Map<String, Set<String>> groupColumnsByParent(Set<String> columnFqns) {
    // Group column FQNs by parent entity FQN
    Map<String, Set<String>> entityToColumns = new HashMap<>();

    for (String columnFqn : columnFqns) {
      String parentFqn = extractParentFqn(columnFqn);
      if (parentFqn != null) {
        entityToColumns.computeIfAbsent(parentFqn, k -> new HashSet<>()).add(columnFqn);
      }
    }

    return entityToColumns;
  }

  private void loadColumnMetadata(
      Map<String, Set<String>> entityToColumns, EntityDocumentFetcher entityFetcher) {
    // Fetch parent entities and extract column metadata
    for (Map.Entry<String, Set<String>> entry : entityToColumns.entrySet()) {
      String parentFqn = entry.getKey();
      if (loadedParentFqns.contains(parentFqn)) {
        continue;
      }
      try {
        Map<String, Object> entityDoc = entityFetcher.fetchEntity(parentFqn);
        extractColumnMetadata(parentFqn, entityDoc, entry.getValue());
        loadedParentFqns.add(parentFqn);
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
  private void extractColumnMetadata(
      String parentFqn, Map<String, Object> entityDoc, Set<String> columnFqns) {
    if (entityDoc == null || !entityDoc.containsKey("columns")) {
      return;
    }

    Object columnsObj = entityDoc.get("columns");
    if (!(columnsObj instanceof List)) {
      return;
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> columns = (List<Map<String, Object>>) columnsObj;
    String entityFqn =
        entityDoc.get("fullyQualifiedName") instanceof String
            ? (String) entityDoc.get("fullyQualifiedName")
            : parentFqn;

    for (Map<String, Object> column : columns) {
      String columnFqn = getColumnFqn(entityFqn, column);
      if (columnFqn != null && columnFqns.contains(columnFqn)) {
        ColumnMetadata metadata = new ColumnMetadata();

        // Extract tags
        if (column.containsKey("tags") && column.get("tags") instanceof List) {
          @SuppressWarnings("unchecked")
          List<Map<String, Object>> tags = (List<Map<String, Object>>) column.get("tags");
          Set<String> classificationTags = new HashSet<>();
          Set<String> glossaryTerms = new HashSet<>();
          for (Map<String, Object> tag : tags) {
            if (tag.containsKey("tagFQN")) {
              String tagFqn = (String) tag.get("tagFQN");
              Object source = tag.get("source");
              if (source != null && "Glossary".equalsIgnoreCase(source.toString())) {
                glossaryTerms.add(tagFqn);
              } else {
                classificationTags.add(tagFqn);
              }
            }
          }
          metadata.setTags(classificationTags);
          metadata.setGlossaryTerms(glossaryTerms);
        }

        cache.put(columnFqn, metadata);
      }
    }
  }

  private String getColumnFqn(String entityFqn, Map<String, Object> column) {
    Object fullyQualifiedName = column.get("fullyQualifiedName");
    if (fullyQualifiedName instanceof String && !nullOrEmpty((String) fullyQualifiedName)) {
      return (String) fullyQualifiedName;
    }

    Object name = column.get("name");
    if (!nullOrEmpty(entityFqn) && name instanceof String) {
      return entityFqn + "." + name;
    }

    return null;
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
    if (metadata.getGlossaryTerms() == null || metadata.getGlossaryTerms().isEmpty()) {
      return false;
    }

    String filterLower = glossaryFilter.toLowerCase();
    for (String glossaryTerm : metadata.getGlossaryTerms()) {
      if (glossaryTerm.toLowerCase().contains(filterLower)
          || glossaryTerm.toLowerCase().endsWith("." + filterLower)) {
        return true;
      }
    }

    return false;
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
    private Set<String> glossaryTerms;

    public Set<String> getTags() {
      return tags;
    }

    public void setTags(Set<String> tags) {
      this.tags = tags;
    }

    public Set<String> getGlossaryTerms() {
      return glossaryTerms;
    }

    public void setGlossaryTerms(Set<String> glossaryTerms) {
      this.glossaryTerms = glossaryTerms;
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

  @FunctionalInterface
  public interface BatchEntityDocumentFetcher {
    Map<String, Map<String, Object>> fetchEntities(Set<String> fqns) throws IOException;
  }
}
