/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CacheConfigTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void parsesExcludedEntityTypesFromCommaSeparatedString() throws Exception {
    final CacheConfig config =
        mapper.readValue(
            """
            {
              "provider": "redis",
              "compressionThresholdBytes": 4096,
              "maxEntrySizeBytes": 262144,
              "populateOnUpsert": true,
              "sessionStore": "jdbc",
              "excludedEntityTypes": " table , testCase , , pipeline "
            }
            """,
            CacheConfig.class);

    assertEquals(4096, config.compressionThresholdBytes);
    assertEquals(262144, config.maxEntrySizeBytes);
    assertTrue(config.populateOnUpsert);
    assertEquals(CacheConfig.SessionStoreMode.jdbc, config.sessionStore);
    assertEquals(Set.of("table", "testCase", "pipeline"), config.getExcludedEntityTypes());
    assertTrue(config.isEntityTypeExcluded("table"));
    assertFalse(config.isEntityTypeExcluded("dashboard"));
    assertFalse(config.isEntityTypeExcluded(null));
  }

  @Test
  void parsesExcludedEntityTypesFromYamlOrJsonListAndEmptyValues() throws Exception {
    final CacheConfig listConfig =
        mapper.readValue(
            "{\"excludedEntityTypes\":[\"table\",\" testSuite \"]}", CacheConfig.class);
    assertEquals(Set.of("table", "testSuite"), listConfig.getExcludedEntityTypes());

    final CacheConfig emptyStringConfig =
        mapper.readValue("{\"excludedEntityTypes\":\"\"}", CacheConfig.class);
    assertTrue(emptyStringConfig.getExcludedEntityTypes().isEmpty());

    final CacheConfig nullConfig =
        mapper.readValue("{\"excludedEntityTypes\":null}", CacheConfig.class);
    assertTrue(nullConfig.getExcludedEntityTypes().isEmpty());
  }

  @Test
  void defaultsAreSafeAndBackwardCompatible() {
    final CacheConfig config = new CacheConfig();
    assertEquals(2048, config.compressionThresholdBytes);
    assertEquals(0, config.maxEntrySizeBytes);
    assertFalse(config.populateOnUpsert);
    assertEquals(CacheConfig.SessionStoreMode.auto, config.sessionStore);
    assertTrue(config.getExcludedEntityTypes().isEmpty());
  }

  @Test
  void rejectsUnsupportedExcludedEntityTypesValue() {
    final CacheConfig config = new CacheConfig();
    assertThrows(IllegalArgumentException.class, () -> config.setExcludedEntityTypes(12345));
  }
}
