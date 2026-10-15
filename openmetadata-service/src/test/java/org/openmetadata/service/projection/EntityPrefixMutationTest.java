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

package org.openmetadata.service.projection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityPrefixMutationTest {
  private final EntityPrefixMutation rewrite =
      new EntityPrefixMutation(1, "chart", "service.before", "service.after");

  @Test
  void derivesTheFormerLocatorOnlyForDescendantsOfTheNewPrefix() {
    assertEquals("service.before.child", rewrite.beforeFqnOf("service.after.child"));
    assertEquals(
        "service.before.service.after.again",
        rewrite.beforeFqnOf("service.after.service.after.again"));
    assertNull(rewrite.beforeFqnOf("service.after"));
    assertNull(rewrite.beforeFqnOf("service.afterSibling.child"));
    assertNull(rewrite.beforeFqnOf(null));
  }

  @Test
  void storesPrefixHashesWithoutTheSeparator() {
    assertEquals(FullyQualifiedName.buildHash("service.before"), rewrite.oldPrefixHash());
    assertEquals(FullyQualifiedName.buildHash("service.after"), rewrite.newPrefixHash());
    assertEquals(MutationFacts.Kind.ENTITY_PREFIX, rewrite.kind());
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" "})
  void prefixesAreRequired(final String prefix) {
    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityPrefixMutation(1, "chart", prefix, "service.after"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityPrefixMutation(1, "chart", "service.before", prefix));
  }

  @Test
  void typeAndVersionAreValidated() {
    assertThrows(
        IllegalArgumentException.class, () -> new EntityPrefixMutation(2, "chart", "a", "b"));
    assertThrows(IllegalArgumentException.class, () -> new EntityPrefixMutation(1, "", "a", "b"));
    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityPrefixMutation(1, "x".repeat(129), "a", "b"));
  }
}
