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
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.utils.JsonUtils;
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

  /** Cursor payload key for the offset-based search/tag pagination cursor. */
  String CURSOR_SEARCH_OFFSET = "searchOffset";

  TypeReference<Map<String, Object>> CURSOR_TYPE = new TypeReference<>() {};

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

  /** Phase 1 result: matching column names and the total doc_count summed across buckets. */
  record NamesWithCount(List<String> names, long totalDocCount) {}

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
