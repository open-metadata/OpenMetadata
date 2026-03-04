/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ConfigSource;

class ConfigSourceResolverTest {

  @Test
  void testComputeHash_sameInputSameHash() {
    Map<String, String> config = Map.of("key", "value");
    String hash1 = ConfigSourceResolver.computeHash(config);
    String hash2 = ConfigSourceResolver.computeHash(config);
    assertEquals(hash1, hash2);
  }

  @Test
  void testComputeHash_differentInputDifferentHash() {
    Map<String, String> config1 = Map.of("key", "value1");
    Map<String, String> config2 = Map.of("key", "value2");
    String hash1 = ConfigSourceResolver.computeHash(config1);
    String hash2 = ConfigSourceResolver.computeHash(config2);
    assertNotEquals(hash1, hash2);
  }

  @Test
  void testShouldUseEnvValue_envModeAlwaysTrue() {
    assertTrue(
        ConfigSourceResolver.shouldUseEnvValue(
            ConfigSource.ENV, "hash1", "hash2", null, null, Timestamp.from(Instant.now())));
  }

  @Test
  void testShouldUseEnvValue_dbModeAlwaysFalse() {
    assertFalse(
        ConfigSourceResolver.shouldUseEnvValue(
            ConfigSource.DB, "hash1", "hash2", null, null, Timestamp.from(Instant.now())));
  }

  @Test
  void testShouldUseEnvValue_autoModeEnvNewer() {
    Timestamp oldDbTime = Timestamp.from(Instant.now().minusSeconds(3600));
    Timestamp restartTime = Timestamp.from(Instant.now());
    assertTrue(
        ConfigSourceResolver.shouldUseEnvValue(
            ConfigSource.AUTO, "newHash", "oldHash", null, oldDbTime, restartTime));
  }

  @Test
  void testShouldUseEnvValue_autoModeDbNewer() {
    Timestamp recentDbTime = Timestamp.from(Instant.now());
    Timestamp oldRestartTime = Timestamp.from(Instant.now().minusSeconds(3600));
    assertFalse(
        ConfigSourceResolver.shouldUseEnvValue(
            ConfigSource.AUTO, "newHash", "oldHash", null, recentDbTime, oldRestartTime));
  }

  @Test
  void testShouldUseEnvValue_autoModeNoChange() {
    String sameHash = "samehash";
    assertFalse(
        ConfigSourceResolver.shouldUseEnvValue(
            ConfigSource.AUTO, sameHash, sameHash, null, null, Timestamp.from(Instant.now())));
  }
}
