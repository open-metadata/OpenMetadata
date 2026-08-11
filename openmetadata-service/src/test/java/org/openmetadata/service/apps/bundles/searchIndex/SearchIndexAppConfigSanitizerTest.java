package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SearchIndexAppConfigSanitizerTest {

  @Test
  void copyWithoutRemovedOptionsReturnsNullForNullConfig() {
    assertNull(SearchIndexAppConfigSanitizer.copyWithoutRemovedOptions(null));
  }

  @Test
  void copyWithoutRemovedOptionsReturnsDefensiveCopyForEmptyConfig() {
    Map<String, Object> config = new LinkedHashMap<>();

    Map<String, Object> sanitized = SearchIndexAppConfigSanitizer.copyWithoutRemovedOptions(config);

    assertNotSame(config, sanitized);
    assertEquals(config, sanitized);
  }

  @Test
  void copyWithoutRemovedOptionsRemovesDeprecatedDistributedOptions() {
    Map<String, Object> config = new LinkedHashMap<>();
    config.put("batchSize", 100);
    config.put("recreateIndex", true);
    config.put("useDistributedIndexing", true);

    Map<String, Object> sanitized = SearchIndexAppConfigSanitizer.copyWithoutRemovedOptions(config);

    assertNotSame(config, sanitized);
    assertEquals(100, sanitized.get("batchSize"));
    assertFalse(sanitized.containsKey("recreateIndex"));
    assertFalse(sanitized.containsKey("useDistributedIndexing"));
    assertEquals(3, config.size());
  }
}
