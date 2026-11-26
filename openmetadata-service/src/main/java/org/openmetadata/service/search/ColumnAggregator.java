/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.ColumnMetadataGrouper.ColumnWithContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface ColumnAggregator {

  Logger LOG = LoggerFactory.getLogger(ColumnAggregator.class);

  /** Max column names to retrieve in the names-only query during pattern search. */
  int MAX_PATTERN_SEARCH_NAMES = 10000;

  /**
   * Number of sample docs pulled per column-name bucket to populate occurrences. Caps
   * {@code ColumnGridItem.totalOccurrences}; columns appearing in more entities than this
   * undercount.
   */
  int SAMPLE_DOCS_PER_COLUMN = 100;

  /** Aggregation names used in pattern-search queries (ES + OS). */
  String AGG_MATCHING_COLUMNS = "matching_columns";

  String AGG_PAGE_COLUMNS = "page_columns";
  String AGG_SAMPLE_DOCS = "sample_docs";
  String AGG_KEY_ORDER = "_key";

  /** Aggregation and composite source names used in browse queries (ES + OS). */
  String AGG_UNIQUE_COLUMNS = "unique_columns";

  String COMPOSITE_COLUMN_NAME = "column_name";

  String NAMES_ACROSS_FIELDS_PARAM = "fields";

  /**
   * Emits every value of the column-name keyword fields passed in {@link
   * #NAMES_ACROSS_FIELDS_PARAM}, so one cardinality aggregation counts a name shared by two fields
   * once.
   */
  String NAMES_ACROSS_FIELDS_SCRIPT =
      "List names = new ArrayList(); for (def field : params."
          + NAMES_ACROSS_FIELDS_PARAM
          + ") { if (doc.containsKey(field)) { names.addAll(doc[field]); } } return names;";

  /** Cursor payload key for the offset-based search/tag pagination cursor. */
  String CURSOR_SEARCH_OFFSET = "searchOffset";

  TypeReference<Map<String, Object>> CURSOR_TYPE = new TypeReference<>() {};

  TypeReference<Map<String, String>> BROWSE_CURSOR_TYPE = new TypeReference<>() {};

  /** Composite buckets order keyword terms by UTF-8 bytes, which String order does not match. */
  Comparator<String> KEYWORD_ORDER =
      Comparator.comparing(name -> name.getBytes(StandardCharsets.UTF_8), Arrays::compareUnsigned);

  ColumnGridResponse aggregateColumns(ColumnAggregationRequest request) throws IOException;

  /**
   * Convert a plain text pattern to a case-insensitive regex for ES/OS terms include. Lucene regex
   * does not support (?i), so each letter is expanded to a character class: "MAT" → [mM][aA][tT].
   */
  static String toCaseInsensitiveRegex(String pattern) {
    StringBuilder sb = new StringBuilder(".*");
    for (char c : pattern.toCharArray()) {
      if (Character.isLetter(c)) {
        sb.append('[')
            .append(Character.toLowerCase(c))
            .append(Character.toUpperCase(c))
            .append(']');
      } else if (".+*?|[](){}^$\\~@&#<>\"".indexOf(c) >= 0) {
        sb.append('\\').append(c);
      } else {
        sb.append(c);
      }
    }
    sb.append(".*");
    return sb.toString();
  }

  /** Encode an offset into the search/tag pagination cursor (base64 JSON). */
  static String encodeSearchOffset(int offset) {
    try {
      String json = JsonUtils.pojoToJson(Map.of(CURSOR_SEARCH_OFFSET, offset));
      return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      LOG.error("Failed to encode search offset", e);
      return null;
    }
  }

  /** Decode the search/tag pagination cursor; restart at 0 for malformed input. */
  static int decodeSearchOffset(String cursor) {
    if (cursor == null) {
      return 0;
    }
    try {
      String json = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
      Map<String, Object> map = JsonUtils.readValue(json, CURSOR_TYPE);
      Object offset = map.get(CURSOR_SEARCH_OFFSET);
      if (offset instanceof Number num) {
        return num.intValue();
      }
      return 0;
    } catch (Exception e) {
      LOG.debug("Failed to decode search offset cursor, restarting from page 1", e);
      return 0;
    }
  }

  /**
   * Encode the browse cursor: one composite after key per column field, because an after key is
   * only valid within the field whose composite aggregation produced it.
   */
  static String encodeBrowseCursor(Map<String, String> afterKeys) {
    String json = JsonUtils.pojoToJson(afterKeys);
    return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }

  /** Decode the browse cursor; a field absent from it, or a malformed cursor, starts at page 1. */
  static Map<String, String> decodeBrowseCursor(String cursor) {
    Map<String, String> afterKeys = Map.of();
    if (cursor != null) {
      try {
        String json = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
        afterKeys =
            new HashMap<>(
                Objects.requireNonNullElse(
                    JsonUtils.readValue(json, BROWSE_CURSOR_TYPE), Map.of()));
        afterKeys.values().removeIf(Objects::isNull);
      } catch (IllegalArgumentException | JsonParsingException e) {
        LOG.debug("Failed to decode browse cursor, restarting from page 1", e);
      }
    }
    return afterKeys;
  }

  /**
   * Merge one ascending composite page per column field into a page of {@code size} distinct names,
   * and move each field's after key past the names it contributed. A field that contributed nothing
   * keeps its after key.
   */
  static BrowsePage nextBrowsePage(
      Map<String, List<String>> keysByField, Map<String, String> afterKeys, int size) {
    List<String> names =
        keysByField.values().stream()
            .flatMap(List::stream)
            .distinct()
            .sorted(KEYWORD_ORDER)
            .limit(size)
            .toList();
    Map<String, String> nextAfterKeys = new HashMap<>(afterKeys);
    boolean hasMore = false;
    if (!names.isEmpty()) {
      String lastName = names.getLast();
      keysByField.forEach(
          (field, keys) ->
              keys.stream()
                  .filter(key -> KEYWORD_ORDER.compare(key, lastName) <= 0)
                  .reduce((previous, next) -> next)
                  .ifPresent(key -> nextAfterKeys.put(field, key)));
      hasMore = keysByField.values().stream().anyMatch(keys -> mayHaveMore(keys, lastName, size));
    }
    return new BrowsePage(names, Map.copyOf(nextAfterKeys), hasMore);
  }

  private static boolean mayHaveMore(List<String> keys, String lastName, int size) {
    return keys.size() >= size
        || (!keys.isEmpty() && KEYWORD_ORDER.compare(keys.getLast(), lastName) > 0);
  }

  /**
   * Merge each field's page rows by bucket key, the unit browse pages and counts by, and name each
   * row after its first occurrence. Table and topic keys are lowercase-normalized, so their case
   * variants share a row; pipeline and ML model keys keep their case.
   */
  static Map<String, List<ColumnWithContext>> mergeRowsByBucketKey(
      List<Map<String, List<ColumnWithContext>>> rowsByBucketKeyPerField) {
    Map<String, List<ColumnWithContext>> rowsByBucketKey = new HashMap<>();
    rowsByBucketKeyPerField.forEach(
        rows ->
            rows.forEach(
                (bucketKey, occurrences) ->
                    rowsByBucketKey
                        .computeIfAbsent(bucketKey, key -> new ArrayList<>())
                        .addAll(occurrences)));
    Map<String, List<ColumnWithContext>> rowsByName = new HashMap<>();
    rowsByBucketKey
        .values()
        .forEach(
            occurrences ->
                rowsByName
                    .computeIfAbsent(
                        occurrences.getFirst().column.getName(), name -> new ArrayList<>())
                    .addAll(occurrences));
    return rowsByName;
  }

  /** Saturating long → int cast for response totals. Caps at Integer.MAX_VALUE. */
  static int toIntSaturating(long value) {
    if (value > Integer.MAX_VALUE) {
      return Integer.MAX_VALUE;
    }
    if (value < 0) {
      return 0;
    }
    return (int) value;
  }

  /**
   * True if a request carries a row-level filter — one that acts on the aggregate status of a
   * grouped column (metadataStatus, hasConflicts, hasMissingMetadata) rather than on individual
   * documents. These cannot be pushed into the search query (the aggregate status is only known
   * after grouping occurrences), so they are applied via {@link #paginateFilteredItems}.
   */
  static boolean hasRowLevelFilter(ColumnAggregationRequest request) {
    return !nullOrEmptyStr(request.getMetadataStatus())
        || Boolean.TRUE.equals(request.getHasConflicts())
        || Boolean.TRUE.equals(request.getHasMissingMetadata());
  }

  /** True if the grouped column satisfies every active row-level filter on the request. */
  static boolean matchesRowFilters(ColumnGridItem item, ColumnAggregationRequest request) {
    if (Boolean.TRUE.equals(request.getHasConflicts())
        && !Boolean.TRUE.equals(item.getHasVariations())) {
      return false;
    }
    if (Boolean.TRUE.equals(request.getHasMissingMetadata()) && !itemHasMissingMetadata(item)) {
      return false;
    }
    String status = request.getMetadataStatus();
    if (!nullOrEmptyStr(status)) {
      String itemStatus = item.getMetadataStatus() != null ? item.getMetadataStatus().value() : "";
      return status.trim().equalsIgnoreCase(itemStatus);
    }
    return true;
  }

  /**
   * Drop columns whose name doesn't contain the request's {@code columnNamePattern}
   * (case-insensitive). The name wildcard in the search query only scopes which entities are
   * scanned; flat-object mapping can't isolate the matching column, so the pattern is enforced per
   * column here. Shared by the ES and OS row-filter scans so their pattern semantics can't drift.
   */
  static void applyColumnNamePattern(
      Map<String, ?> columnsByName, ColumnAggregationRequest request) {
    if (nullOrEmptyStr(request.getColumnNamePattern())) {
      return;
    }
    String pattern = request.getColumnNamePattern().toLowerCase(Locale.ROOT);
    columnsByName.keySet().removeIf(name -> !name.toLowerCase(Locale.ROOT).contains(pattern));
  }

  /** A column has missing metadata if any of its groups lacks a description or tags. */
  static boolean itemHasMissingMetadata(ColumnGridItem item) {
    if (item.getGroups() == null) {
      return true;
    }
    return item.getGroups().stream()
        .anyMatch(
            group ->
                (group.getDescription() == null || group.getDescription().isEmpty())
                    || (group.getTags() == null || group.getTags().isEmpty()));
  }

  /**
   * Apply row-level filters to the fully-grouped column list and paginate the result in memory.
   * Filtering the aggregate items (not documents) is what makes a "Complete"/"Incomplete"/… filter
   * return only rows whose displayed status matches, and computing totals from the filtered set is
   * what keeps the page count and per-page size correct (issue #26824). Ordering is by column name
   * (case-insensitive) so the offset cursor is stable across pages.
   */
  static ColumnGridResponse paginateFilteredItems(
      List<ColumnGridItem> allItems, ColumnAggregationRequest request) {
    List<ColumnGridItem> filtered =
        allItems.stream()
            .filter(item -> matchesRowFilters(item, request))
            .sorted(
                Comparator.comparing(
                    ColumnGridItem::getColumnName,
                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
            .toList();

    int totalUniqueColumns = filtered.size();
    int totalOccurrences =
        filtered.stream()
            .mapToInt(item -> item.getTotalOccurrences() != null ? item.getTotalOccurrences() : 0)
            .sum();

    int offset = decodeSearchOffset(request.getCursor());
    int pageSize = request.getSize();
    int fromIndex = Math.min(offset, totalUniqueColumns);
    int toIndex = Math.min(offset + pageSize, totalUniqueColumns);

    List<ColumnGridItem> page = new ArrayList<>(filtered.subList(fromIndex, toIndex));
    boolean hasMore = toIndex < totalUniqueColumns;
    String cursor = hasMore ? encodeSearchOffset(toIndex) : null;

    ColumnGridResponse response = new ColumnGridResponse();
    response.setColumns(page);
    response.setTotalUniqueColumns(totalUniqueColumns);
    response.setTotalOccurrences(totalOccurrences);
    response.setCursor(cursor);
    return response;
  }

  private static boolean nullOrEmptyStr(String s) {
    return s == null || s.isBlank();
  }

  /**
   * Parse a {@link TagLabel} out of an ES/OS column's raw {@code tags} array entry. Reads the
   * common fields ({@code name}, {@code displayName}, {@code description}, {@code style}) in
   * addition to the label-specific ones, mirroring what {@code TagLabelRowMapperWithTargetFqnHash}
   * populates for the DB-backed read path so tag icon/color render consistently everywhere.
   */
  static TagLabel parseTagLabel(JsonNode tagData) {
    return JsonUtils.convertValueLenient(tagData, TagLabel.class);
  }

  /** Phase 1 result: matching column names and the total doc_count summed across buckets. */
  record NamesWithCount(List<String> names, long totalDocCount) {}

  /** One browse page merged across column fields, with each field's after key for the next page. */
  record BrowsePage(List<String> names, Map<String, String> afterKeys, boolean hasMore) {}

  class ColumnAggregationRequest {
    private int size = 1000;
    private String cursor;
    private String columnNamePattern;
    private List<String> entityTypes;
    private String serviceName;
    private List<String> serviceTypes;
    private String databaseName;
    private String schemaName;
    private String domainId;
    private Boolean hasConflicts;
    private Boolean hasMissingMetadata;
    private String metadataStatus;
    private List<String> tags;
    private List<String> glossaryTerms;
    // The caller whose search policies scope the documents the grid aggregates over.
    private SubjectContext subjectContext;

    public SubjectContext getSubjectContext() {
      return subjectContext;
    }

    public void setSubjectContext(SubjectContext subjectContext) {
      this.subjectContext = subjectContext;
    }

    public int getSize() {
      return size;
    }

    public void setSize(int size) {
      this.size = size;
    }

    public String getCursor() {
      return cursor;
    }

    public void setCursor(String cursor) {
      this.cursor = cursor;
    }

    public String getColumnNamePattern() {
      return columnNamePattern;
    }

    public void setColumnNamePattern(String columnNamePattern) {
      this.columnNamePattern = columnNamePattern;
    }

    public List<String> getEntityTypes() {
      return entityTypes;
    }

    public void setEntityTypes(List<String> entityTypes) {
      this.entityTypes = entityTypes;
    }

    public String getServiceName() {
      return serviceName;
    }

    public void setServiceName(String serviceName) {
      this.serviceName = serviceName;
    }

    public List<String> getServiceTypes() {
      return serviceTypes;
    }

    public void setServiceTypes(List<String> serviceTypes) {
      this.serviceTypes = serviceTypes;
    }

    public String getDatabaseName() {
      return databaseName;
    }

    public void setDatabaseName(String databaseName) {
      this.databaseName = databaseName;
    }

    public String getSchemaName() {
      return schemaName;
    }

    public void setSchemaName(String schemaName) {
      this.schemaName = schemaName;
    }

    public String getDomainId() {
      return domainId;
    }

    public void setDomainId(String domainId) {
      this.domainId = domainId;
    }

    public Boolean getHasConflicts() {
      return hasConflicts;
    }

    public void setHasConflicts(Boolean hasConflicts) {
      this.hasConflicts = hasConflicts;
    }

    public Boolean getHasMissingMetadata() {
      return hasMissingMetadata;
    }

    public void setHasMissingMetadata(Boolean hasMissingMetadata) {
      this.hasMissingMetadata = hasMissingMetadata;
    }

    public String getMetadataStatus() {
      return metadataStatus;
    }

    public void setMetadataStatus(String metadataStatus) {
      this.metadataStatus = metadataStatus;
    }

    public List<String> getTags() {
      return tags;
    }

    public void setTags(List<String> tags) {
      this.tags = tags;
    }

    public List<String> getGlossaryTerms() {
      return glossaryTerms;
    }

    public void setGlossaryTerms(List<String> glossaryTerms) {
      this.glossaryTerms = glossaryTerms;
    }
  }
}
