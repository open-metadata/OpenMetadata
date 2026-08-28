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

package org.openmetadata.operator.unit;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.operator.util.KubernetesNameBuilder;

class KubernetesNameBuilderTest {

  @Test
  void testReturnsShortNameAsIs() {
    assertEquals("test-omjob", KubernetesNameBuilder.fitNameWithHash("test-omjob", 20, "omjob"));
  }

  @Test
  void testTrimsTrailingSeparatorsAfterTruncation() {
    String name = KubernetesNameBuilder.fitNameWithHash("a".repeat(51) + ".suffix", 52, "omjob");

    assertTrue(name.matches("^[a-z0-9-]+$"));
    assertFalse(name.endsWith("-"));
  }

  @Test
  void testKeepsTruncatedNamesUnique() {
    String sharedPrefix = "a".repeat(52);
    String firstName =
        KubernetesNameBuilder.fitNameWithHash(sharedPrefix + "-first-scheduled-run", 52, "omjob");
    String secondName =
        KubernetesNameBuilder.fitNameWithHash(sharedPrefix + "-second-scheduled-run", 52, "omjob");

    assertEquals(52, firstName.length());
    assertEquals(52, secondName.length());
    assertNotEquals(firstName, secondName);
  }

  @Test
  void testUsesHashWhenTruncationRemovesEntirePrefix() {
    String name = KubernetesNameBuilder.fitNameWithHash("....", 3, "omjob");

    assertEquals(3, name.length());
    assertTrue(name.matches("^[a-f0-9]+$"));
  }

  @Test
  void testThrowsWhenFallbackStillExceedsAllowedLength() {
    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> KubernetesNameBuilder.fitNameWithHash("", 4, "omjob"));

    assertTrue(exception.getMessage().contains("Fallback name exceeds max base length"));
  }
}
