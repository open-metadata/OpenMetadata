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

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.openmetadata.schema.configuration.SearchIndexMappings;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the default, field-safety-hardened search index mappings that are persisted in settings
 * ({@code searchIndexMappings}) and read at index-creation time. The hardening transform ({@link
 * SearchIndexSettings#harden}) runs once here, when the default blob is produced, so the stored,
 * admin-editable mapping already carries {@code ignore_above}/{@code ignore_malformed}/limits
 * instead of having them injected on every index create. Shared by the fresh-install seeder, the
 * upgrade migration, the per-entity reset endpoint and the runtime resource fallback.
 */
public final class SearchIndexMappingsSeeder {

  private static final Logger LOG = LoggerFactory.getLogger(SearchIndexMappingsSeeder.class);

  private SearchIndexMappingsSeeder() {}

  public static List<String> supportedLanguages() {
    return Arrays.stream(IndexMappingLanguage.values())
        .map(language -> language.value().toLowerCase(Locale.ROOT))
        .toList();
  }

  public static SearchIndexMappings buildDefaultBlob() {
    return buildDefaultBlob(supportedLanguages());
  }

  public static SearchIndexMappings buildDefaultBlob(List<String> languages) {
    ensureLoaderInitialized();
    SearchFieldLimits limits = SearchFieldLimits.active();
    Map<String, IndexMapping> registry = IndexMappingLoader.getInstance().getIndexMapping();
    Map<String, Map<String, Object>> byLanguage = new LinkedHashMap<>();
    for (String language : languages) {
      byLanguage.put(language, buildLanguageMappings(registry, language, limits));
    }
    return new SearchIndexMappings().withLanguages(byLanguage);
  }

  /** Hardened default mapping for one (language, entityType), or {@code null} when none exists. */
  public static Map<String, Object> buildEntityMapping(String language, String entityType) {
    ensureLoaderInitialized();
    IndexMapping indexMapping = IndexMappingLoader.getInstance().getIndexMapping().get(entityType);
    Map<String, Object> result = null;
    if (indexMapping != null) {
      result = hardenedResourceMapping(indexMapping, language, SearchFieldLimits.active());
    }
    return result;
  }

  private static Map<String, Object> buildLanguageMappings(
      Map<String, IndexMapping> registry, String language, SearchFieldLimits limits) {
    Map<String, Object> entityMappings = new LinkedHashMap<>();
    for (Map.Entry<String, IndexMapping> entry : registry.entrySet()) {
      Map<String, Object> mapping = hardenedResourceMapping(entry.getValue(), language, limits);
      if (mapping != null) {
        entityMappings.put(entry.getKey(), mapping);
      }
    }
    return entityMappings;
  }

  private static Map<String, Object> hardenedResourceMapping(
      IndexMapping indexMapping, String language, SearchFieldLimits limits) {
    Map<String, Object> result = null;
    String content = readResource(indexMapping.getIndexMappingFile(language));
    if (content != null) {
      result = JsonUtils.getMapFromJson(SearchIndexSettings.harden(content, limits));
    }
    return result;
  }

  private static String readResource(String resourcePath) {
    String result = null;
    try (InputStream in =
        SearchIndexMappingsSeeder.class.getClassLoader().getResourceAsStream(resourcePath)) {
      if (in == null) {
        LOG.debug("No index mapping resource at {}", resourcePath);
      } else {
        result = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      }
    } catch (IOException readFailed) {
      LOG.warn("Failed reading index mapping resource {}", resourcePath, readFailed);
    }
    return result;
  }

  private static void ensureLoaderInitialized() {
    try {
      IndexMappingLoader.getInstance();
    } catch (IllegalStateException notInitialized) {
      try {
        IndexMappingLoader.init();
      } catch (IOException initFailed) {
        throw new IllegalStateException(
            "Failed to initialize IndexMappingLoader for search index mapping seeding", initFailed);
      }
    }
  }
}
