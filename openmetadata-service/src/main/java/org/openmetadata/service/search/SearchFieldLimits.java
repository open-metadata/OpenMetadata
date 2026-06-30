/*
 *  Copyright 2024 Collate.
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

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.schema.configuration.SearchIndexMappings;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.SearchIndexingLimits;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Immutable holder for the field limits enforced while building search documents. Values default to
 * the documented Elasticsearch/OpenSearch engine defaults and can be overridden via {@link
 * SearchIndexingLimits} in the search configuration so operators can tune them without changing
 * cluster/infrastructure settings.
 */
public final class SearchFieldLimits {

  private static final Logger LOG = LoggerFactory.getLogger(SearchFieldLimits.class);

  private static volatile SearchFieldLimits active;

  /**
   * Per-entity-type limits resolved from the stored, admin-editable mapping (its {@code
   * settings.index.mapping.depth.limit}), so that updating a mapping via the search-index-mappings
   * API and reindexing changes the document-build depth for that entity. Memoized to avoid
   * deserializing the mapping blob on every document build; cleared by {@link #invalidateEntityCache}
   * when the stored mappings change. Bounded by the number of entity types.
   */
  private static final Map<String, SearchFieldLimits> PER_ENTITY = new ConcurrentHashMap<>();

  private static final List<String> DEPTH_LIMIT_PATH =
      List.of("settings", "index", "mapping", "depth", "limit");

  /** Hard Lucene per-term limit ({@code IndexWriter.MAX_TERM_LENGTH}); not configurable upward. */
  public static final int LUCENE_KEYWORD_MAX_BYTES = 32766;

  public static final int DEFAULT_DEPTH_LIMIT = 20;
  public static final int DEFAULT_NESTED_OBJECTS_LIMIT = 10000;
  public static final int DEFAULT_TOTAL_FIELDS_LIMIT = 1000;
  public static final int DEFAULT_MAX_COLUMNS = 10000;

  private static final int MAX_UTF8_BYTES_PER_CHAR = 4;

  private final boolean hardeningEnabled;
  private final int keywordMaxBytes;
  private final int depthLimit;
  private final int nestedObjectsLimit;
  private final int totalFieldsLimit;
  private final int maxColumns;
  private final int safeCharThreshold;

  private SearchFieldLimits(
      boolean hardeningEnabled,
      int keywordMaxBytes,
      int depthLimit,
      int nestedObjectsLimit,
      int totalFieldsLimit,
      int maxColumns) {
    this.hardeningEnabled = hardeningEnabled;
    this.keywordMaxBytes = keywordMaxBytes;
    this.depthLimit = depthLimit;
    this.nestedObjectsLimit = nestedObjectsLimit;
    this.totalFieldsLimit = totalFieldsLimit;
    this.maxColumns = maxColumns;
    this.safeCharThreshold = keywordMaxBytes / MAX_UTF8_BYTES_PER_CHAR;
  }

  public static SearchFieldLimits defaults() {
    return new SearchFieldLimits(
        true,
        LUCENE_KEYWORD_MAX_BYTES,
        DEFAULT_DEPTH_LIMIT,
        DEFAULT_NESTED_OBJECTS_LIMIT,
        DEFAULT_TOTAL_FIELDS_LIMIT,
        DEFAULT_MAX_COLUMNS);
  }

  public static SearchFieldLimits from(ElasticSearchConfiguration configuration) {
    SearchFieldLimits result = defaults();
    if (configuration != null && configuration.getSearchIndexingLimits() != null) {
      result = fromLimits(configuration.getSearchIndexingLimits());
    }
    return result;
  }

  /**
   * The limits resolved from the running search configuration, cached after first use. Falls back to
   * {@link #defaults()} when the configuration has not been initialized (e.g. in unit tests).
   */
  public static SearchFieldLimits active() {
    SearchFieldLimits result = active;
    if (result == null) {
      result = loadActive();
    }
    return result;
  }

  public static void setActive(SearchFieldLimits limits) {
    active = limits;
    PER_ENTITY.clear();
  }

  /**
   * Limits for building documents of {@code entityType}, overlaying the depth limit from that
   * entity's stored mapping onto {@link #active()}. Falls back to {@link #active()} when no entity
   * type is given or no stored override exists.
   */
  public static SearchFieldLimits forEntity(String entityType) {
    SearchFieldLimits result = active();
    if (entityType != null && !entityType.isBlank()) {
      result = PER_ENTITY.computeIfAbsent(entityType, SearchFieldLimits::resolveForEntity);
    }
    return result;
  }

  /** Drops the memoized per-entity limits so the next build re-reads the stored mappings. */
  public static void invalidateEntityCache() {
    PER_ENTITY.clear();
  }

  private static SearchFieldLimits resolveForEntity(String entityType) {
    SearchFieldLimits base = active();
    Integer storedDepth = storedDepthLimit(entityType);
    SearchFieldLimits result = base;
    if (storedDepth != null && storedDepth > 0 && storedDepth != base.getDepthLimit()) {
      result = base.withDepthLimit(storedDepth);
    }
    return result;
  }

  private static Integer storedDepthLimit(String entityType) {
    Integer result = null;
    try {
      SearchIndexMappings stored =
          SettingsCache.getSettingOrDefault(
              SettingsType.SEARCH_INDEX_MAPPINGS, null, SearchIndexMappings.class);
      result = depthLimitFromMapping(entityMapping(stored, entityType));
    } catch (Exception notResolved) {
      LOG.debug("Could not resolve stored depth limit for entity {}", entityType, notResolved);
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> entityMapping(SearchIndexMappings stored, String entityType) {
    Map<String, Object> result = null;
    if (stored != null && stored.getLanguages() != null) {
      for (Map<String, Object> byEntity : stored.getLanguages().values()) {
        if (byEntity != null && byEntity.get(entityType) instanceof Map<?, ?> mapping) {
          result = (Map<String, Object>) mapping;
          break;
        }
      }
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static Integer depthLimitFromMapping(Map<String, Object> mapping) {
    Object node = mapping;
    for (String key : DEPTH_LIMIT_PATH) {
      node = node instanceof Map ? ((Map<String, Object>) node).get(key) : null;
    }
    return node instanceof Number depth ? depth.intValue() : null;
  }

  SearchFieldLimits withDepthLimit(int newDepthLimit) {
    return new SearchFieldLimits(
        hardeningEnabled,
        keywordMaxBytes,
        newDepthLimit,
        nestedObjectsLimit,
        totalFieldsLimit,
        maxColumns);
  }

  private static synchronized SearchFieldLimits loadActive() {
    SearchFieldLimits result = active;
    if (result == null) {
      try {
        result = from(IndexMappingLoader.getInstance().getElasticSearchConfiguration());
        active = result;
      } catch (IllegalStateException notInitialized) {
        LOG.debug("IndexMappingLoader not initialized; using default search field limits");
        result = defaults();
      }
    }
    return result;
  }

  private static SearchFieldLimits fromLimits(SearchIndexingLimits limits) {
    return new SearchFieldLimits(
        limits.getEnableMappingHardening() == null || limits.getEnableMappingHardening(),
        clampKeywordBytes(limits.getKeywordMaxBytes()),
        orDefault(limits.getMappingDepthLimit(), DEFAULT_DEPTH_LIMIT),
        orDefault(limits.getNestedObjectsLimit(), DEFAULT_NESTED_OBJECTS_LIMIT),
        orDefault(limits.getTotalFieldsLimit(), DEFAULT_TOTAL_FIELDS_LIMIT),
        orDefault(limits.getMaxColumns(), DEFAULT_MAX_COLUMNS));
  }

  private static int orDefault(Integer value, int fallback) {
    return value != null && value > 0 ? value : fallback;
  }

  private static int clampKeywordBytes(Integer value) {
    int resolved = orDefault(value, LUCENE_KEYWORD_MAX_BYTES);
    // Keep at least one UTF-8 character's worth of bytes so ignore_above (value/4) is never 0.
    return Math.min(Math.max(resolved, MAX_UTF8_BYTES_PER_CHAR), LUCENE_KEYWORD_MAX_BYTES);
  }

  public boolean isHardeningEnabled() {
    return hardeningEnabled;
  }

  public int getKeywordMaxBytes() {
    return keywordMaxBytes;
  }

  public int getDepthLimit() {
    return depthLimit;
  }

  public int getNestedObjectsLimit() {
    return nestedObjectsLimit;
  }

  public int getTotalFieldsLimit() {
    return totalFieldsLimit;
  }

  public int getMaxColumns() {
    return maxColumns;
  }

  /**
   * Strings at or below this character count cannot exceed {@link #getKeywordMaxBytes()} bytes (UTF-8
   * is at most 4 bytes per character), so callers can skip byte-length computation for them.
   */
  public int getSafeCharThreshold() {
    return safeCharThreshold;
  }
}
