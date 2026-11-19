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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;

/** Secret ids of list elements stay distinct and stable; masked secrets follow their element. */
class ReflectionUtilCollectionKeysTest {

  @Test
  void keysUniqueNamesByName() {
    assertEquals(List.of("alpha", "beta"), keys("alpha", "beta"));
  }

  /** Exact duplicates and unnamed elements have nothing but their position to tell them apart. */
  @Test
  void keysRepeatedAndMissingNamesByPosition() {
    assertEquals(List.of("#0", "#1", "#2", "solo"), keys("dup", "dup", null, "solo"));
  }

  @Test
  void neverKeysANameThatLooksLikeAPosition() {
    assertEquals("#1", keys("#1", "dup", "dup").get(1));
    assertNotEquals("#1", keys("#1", "dup", "dup").getFirst());
  }

  /**
   * Secret ids are lowercased and stripped of other characters, so names that would share one are
   * keyed by a hash of their exact text, which does not move when the list is reordered.
   */
  @Test
  void keysNamesThatShareASecretIdByAStableHash() {
    final List<String> keys = keys("Prod", "prod", "other");
    final List<String> reordered = keys("prod", "other", "Prod");

    assertTrue(keys.getFirst().matches("h[0-9a-f]{16}"));
    assertNotEquals(keys.getFirst(), keys.get(1));
    assertEquals(List.of(keys.get(1), "other", keys.getFirst()), reordered);
    assertNotEquals(keys("prod-1", "prod_1").getFirst(), keys("prod-1", "prod_1").get(1));
  }

  /** A name made only of digits would share a secret id with a position once "#" is removed. */
  @Test
  void keysNamesWithoutLettersByAStableHash() {
    final List<String> keys = keys("3", "##", "named");

    assertTrue(keys.getFirst().matches("h[0-9a-f]{16}"));
    assertTrue(keys.get(1).matches("h[0-9a-f]{16}"));
    assertEquals("named", keys.get(2));
    assertEquals(keys.getFirst(), keys("named", "3").get(1));
  }

  /** A name that looks like a hashed name is hashed too, so it never takes another's secret id. */
  @Test
  void keysANameThatLooksLikeAHashedNameByItsOwnHash() {
    final String hashOfThree = keys("3").getFirst();
    final List<String> keys = keys("3", hashOfThree);

    assertEquals(hashOfThree, keys.getFirst());
    assertNotEquals(hashOfThree, keys.get(1));
    assertTrue(keys.get(1).matches("h[0-9a-f]{16}"));
  }

  /** Restoring a masked secret matches the exact name, so distinct names keep their own keys. */
  @Test
  void identifiesDistinctNamesByNameAndEscapesAPositionLikeName() {
    assertEquals(List.of("Prod", "prod", "3"), identities("Prod", "prod", "3"));
    assertEquals(List.of("##1", "#1", "#2"), identities("#1", "dup", "dup"));
  }

  private static List<String> identities(String... names) {
    return ReflectionUtil.getCollectionElementIdentities(servers(names));
  }

  private static List<McpServerConfig> servers(String... names) {
    return Arrays.stream(names).map(name -> new McpServerConfig().withName(name)).toList();
  }

  private static List<String> keys(String... names) {
    return ReflectionUtil.getCollectionElementKeys(servers(names));
  }
}
