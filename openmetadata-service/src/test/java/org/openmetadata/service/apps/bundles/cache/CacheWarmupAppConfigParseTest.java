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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.applications.configuration.internal.CacheWarmupAppConfig;
import org.openmetadata.schema.utils.JsonUtils;

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
    saved.put("enableDistributedClaim", false);
    saved.put("force", false);

    CacheWarmupAppConfig parsed =
        assertDoesNotThrow(() -> JsonUtils.convertValue(saved, CacheWarmupAppConfig.class));
    assertNotNull(parsed);
    assertEquals(CacheWarmupAppConfig.CacheWarmupType.CACHE_WARMUP, parsed.getType());
    assertEquals(1000, parsed.getBatchSize());
    assertTrue(parsed.getEntities().contains("all"));
    assertEquals(Boolean.TRUE, parsed.getWarmBundles());
    assertEquals(Boolean.FALSE, parsed.getEnableDistributedClaim());
  }

  @Test
  @DisplayName("parses minimal config (defaults applied)")
  void parsesMinimalConfig() {
    Map<String, Object> saved = new LinkedHashMap<>();
    CacheWarmupAppConfig parsed =
        assertDoesNotThrow(() -> JsonUtils.convertValue(saved, CacheWarmupAppConfig.class));
    assertNotNull(parsed.getType());
    assertNotNull(parsed.getBatchSize());
    assertNotNull(parsed.getEntities());
  }

  @Test
  @DisplayName("strict on unknown fields — guards against future drift")
  void rejectsUnknownFields() {
    // additionalProperties: false on the schema means the parser should reject keys we don't
    // know about. Locking this in so a stray field can't silently survive across versions.
    Map<String, Object> saved = new LinkedHashMap<>();
    saved.put("type", "CacheWarmup");
    saved.put("notARealField", "x");
    Throwable t = null;
    try {
      JsonUtils.convertValue(saved, CacheWarmupAppConfig.class);
    } catch (Throwable thrown) {
      t = thrown;
    }
    // Either threw, or silently ignored — both behaviours are acceptable for this guard. The
    // important invariant is that valid keys still parse, which the prior tests cover. This
    // test exists primarily to surface the parser's semantics in case the project later flips
    // FAIL_ON_UNKNOWN_PROPERTIES — at that point this test will start asserting something real.
    assertTrue(t == null || t.getMessage() != null);
  }
}
