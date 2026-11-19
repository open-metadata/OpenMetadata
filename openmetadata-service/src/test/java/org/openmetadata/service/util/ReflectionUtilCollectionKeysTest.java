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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;

class ReflectionUtilCollectionKeysTest {

  @Test
  void keysUniqueNamesByName() {
    assertEquals(List.of("alpha", "beta"), keys("alpha", "beta"));
  }

  @Test
  void keysRepeatedAndMissingNamesByPosition() {
    assertEquals(List.of("#0", "#1", "#2", "solo"), keys("dup", "dup", null, "solo"));
  }

  @Test
  void neverKeysANameThatLooksLikeAPosition() {
    assertEquals(List.of("#0", "#1", "#2"), keys("#1", "dup", "dup"));
  }

  /** Secret ids are lowercased and stripped of other characters, so these share one secret. */
  @Test
  void keysNamesThatShareASecretIdByPosition() {
    assertEquals(List.of("#0", "#1", "other"), keys("Prod", "prod", "other"));
    assertEquals(List.of("#0", "#1"), keys("prod-1", "prod_1"));
  }

  /** A name made only of digits would share a secret id with a position once "#" is removed. */
  @Test
  void keysNamesWithoutLettersByPosition() {
    assertEquals(List.of("#0", "#1", "named"), keys("3", "##", "named"));
  }

  private static List<String> keys(String... names) {
    return ReflectionUtil.getCollectionElementKeys(
        Arrays.stream(names).map(name -> new McpServerConfig().withName(name)).toList());
  }
}
