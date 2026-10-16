package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

final class SearchIndexAppConfigSanitizer {
  private static final Set<String> REMOVED_OPTIONS =
      Set.of("recreateIndex", "useDistributedIndexing");

  private SearchIndexAppConfigSanitizer() {}

  static Map<String, Object> copyWithoutRemovedOptions(Map<String, Object> config) {
    if (config == null) {
      return config;
    }
    Map<String, Object> sanitized = new LinkedHashMap<>(config);
    removeRemovedOptions(sanitized);
    return sanitized;
  }

  static void removeRemovedOptions(Map<String, Object> config) {
    if (config == null || config.isEmpty()) {
      return;
    }
    REMOVED_OPTIONS.forEach(config::remove);
  }
}
