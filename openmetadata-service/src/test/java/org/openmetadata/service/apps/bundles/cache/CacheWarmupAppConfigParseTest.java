/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.apps.bundles.cache;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.applications.configuration.internal.CacheWarmupAppConfig;

/**
 * Regression tests for the CacheWarmup app configuration schema. The app used to parse its
 * saved JSON as {@code EventPublisherJob} (the SearchIndexApp schema). When the
 * cacheWarmupAppConfig schema gained a {@code type} discriminator, every Configuration page load
 * surfaced an "Unrecognized field 'type'" error and the workaround flag-reading code in the app
 * silently skipped fields it didn't know about. These tests pin the parser to the right schema.
 */
class CacheWarmupAppConfigParseTest {

  @Test
  @DisplayName("parses saved app config with the type discriminator")
  void parsesSavedConfigWithType() {
    Map<String, Object> saved = new LinkedHashMap<>();
    saved.put("type", "CacheWarmup");
    saved.put("entities", List.of("all"));
    saved.put("batchSize", 1000);
    saved.put("warmBundles", true);
    saved.put("warmRelationships", false);
    saved.put("enableDistributedClaim", false);
    saved.put("force", false);

    CacheWarmupAppConfig parsed =
        assertDoesNotThrow(() -> CacheWarmupApp.normalizeAppConfig(saved));
    assertNotNull(parsed);
    assertEquals(CacheWarmupAppConfig.CacheWarmupType.CACHE_WARMUP, parsed.getType());
    assertEquals(1000, parsed.getBatchSize());
    assertTrue(parsed.getEntities().contains("all"));
    assertEquals(Boolean.TRUE, parsed.getWarmBundles());
    assertEquals(Boolean.FALSE, parsed.getWarmRelationships());
    assertEquals(Boolean.FALSE, parsed.getEnableDistributedClaim());
  }

  @Test
  @DisplayName("parses minimal config (defaults applied)")
  void parsesMinimalConfig() {
    Map<String, Object> saved = new LinkedHashMap<>();
    CacheWarmupAppConfig parsed =
        assertDoesNotThrow(() -> CacheWarmupApp.normalizeAppConfig(saved));
    assertNotNull(parsed.getType());
    assertNotNull(parsed.getBatchSize());
    assertNotNull(parsed.getEntities());
  }

  @Test
  @DisplayName("parses literal null config as defaults")
  void parsesLiteralNullConfigAsDefaults() {
    CacheWarmupAppConfig parsed =
        assertDoesNotThrow(() -> CacheWarmupApp.normalizeAppConfig("null"));
    assertNotNull(parsed.getType());
    assertNotNull(parsed.getBatchSize());
    assertNotNull(parsed.getEntities());
  }

  @Test
  @DisplayName("parses legacy persisted config with removed queue fields")
  void parsesLegacyConfigWithRemovedQueueFields() {
    Map<String, Object> saved = new LinkedHashMap<>();
    saved.put("type", "CacheWarmup");
    saved.put("entities", List.of("all"));
    saved.put("batchSize", 100);
    saved.put("consumerThreads", 4);
    saved.put("queueSize", 1000);

    CacheWarmupAppConfig parsed =
        assertDoesNotThrow(() -> CacheWarmupApp.normalizeAppConfig(saved));

    assertEquals(CacheWarmupAppConfig.CacheWarmupType.CACHE_WARMUP, parsed.getType());
    assertEquals(100, parsed.getBatchSize());
    assertTrue(parsed.getEntities().contains("all"));

    String savedJson =
        "{\"type\":\"CacheWarmup\",\"entities\":[\"all\"],\"batchSize\":100,\"queueSize\":1000}";
    CacheWarmupAppConfig parsedJson =
        assertDoesNotThrow(() -> CacheWarmupApp.normalizeAppConfig(savedJson));
    assertEquals(100, parsedJson.getBatchSize());
  }

  @Test
  @DisplayName("rejects unknown non-legacy config fields")
  void rejectsUnknownNonLegacyConfigFields() {
    Map<String, Object> saved = new LinkedHashMap<>();
    saved.put("type", "CacheWarmup");
    saved.put("unknownField", true);

    assertThrows(IllegalArgumentException.class, () -> CacheWarmupApp.normalizeAppConfig(saved));
  }
}
